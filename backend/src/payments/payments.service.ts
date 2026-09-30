import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { BookingStatus, HoldStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ConfigurablePaymentAdapter } from './adapters/configurable-payment.adapter';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { Role } from '../common/enums/role.enum';
import { randomBytes } from 'crypto';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentAdapter: ConfigurablePaymentAdapter,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  private generatePaymentNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = randomBytes(4).toString('hex').toUpperCase();
    return `PAY-${dateStr}-${randomHex}`;
  }

  private generateBookingNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = randomBytes(4).toString('hex').toUpperCase();
    return `TB-${dateStr}-${randomHex}`;
  }

  private formatDateIso(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  // ---------------------------------------------------------------------------
  // 1. CREATE PAYMENT ORDER
  // ---------------------------------------------------------------------------

  async createOrder(userId: string, dto: CreateOrderDto) {
    // Idempotency check
    if (dto.idempotencyKey) {
      const existingPayment = await this.prisma.payment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
      });
      if (existingPayment) {
        return {
          paymentId: existingPayment.id,
          paymentNumber: existingPayment.paymentNumber,
          orderId: existingPayment.orderId,
          amount: Number(existingPayment.amount),
          currency: existingPayment.currency,
          provider: existingPayment.provider,
          status: existingPayment.status,
          keyId: this.paymentAdapter
            .createOrder({ amount: 0, currency: 'INR', orderReference: '' })
            .then((r) => r.keyId),
        };
      }
    }

    let calculatedAmount = dto.amount;
    let slotHoldId: string | null = null;
    let bookingId: string | null = null;
    let paymentType = 'FULL';

    // A. Created for a SlotHold
    if (dto.holdId) {
      const hold = await this.prisma.slotHold.findUnique({
        where: { id: dto.holdId },
        include: { turf: true },
      });

      if (!hold) {
        throw new NotFoundException(
          `SlotHold with ID "${dto.holdId}" not found`,
        );
      }

      if (hold.userId !== userId) {
        throw new ForbiddenException(
          'You cannot create a payment for another user’s hold',
        );
      }

      if (hold.status !== HoldStatus.ACTIVE || hold.expiresAt < new Date()) {
        await this.prisma.slotHold.update({
          where: { id: hold.id },
          data: { status: HoldStatus.EXPIRED, activeHoldKey: null },
        });
        throw new GoneException(
          'Slot hold has expired. Please select the slot again.',
        );
      }

      slotHoldId = hold.id;
      const holdTotal = Number(hold.totalPrice);
      const isAdvance =
        dto.isAdvance ||
        dto.advanceAmount !== undefined ||
        hold.isAdvanceHold;

      if (isAdvance) {
        const turf = hold.turf;
        if (!turf?.advancePaymentAllowed) {
          throw new BadRequestException(
            'Advance payment is not allowed for this turf venue',
          );
        }

        const minPercentage = Number(turf?.minAdvancePercentage ?? 20);
        const minFixed = Number(turf?.minAdvanceAmount ?? 0);
        const calculatedMinAdvance = Math.min(
          holdTotal,
          Math.max(minFixed, Math.round((holdTotal * minPercentage) / 100)),
        );

        let advAmt =
          dto.advanceAmount ||
          (dto.isAdvance
            ? dto.amount || (hold.advanceAmount ? Number(hold.advanceAmount) : calculatedMinAdvance)
            : hold.advanceAmount ? Number(hold.advanceAmount) : calculatedMinAdvance);

        if (advAmt < calculatedMinAdvance) {
          throw new BadRequestException(
            `Advance payment must be at least ₹${calculatedMinAdvance} (${minPercentage}% of total ₹${holdTotal})`,
          );
        }
        if (advAmt > holdTotal) {
          throw new BadRequestException(
            `Advance payment cannot exceed total price of ₹${holdTotal}`,
          );
        }

        calculatedAmount = advAmt;
        paymentType = 'ADVANCE';
      } else {
        calculatedAmount = holdTotal;
        paymentType = 'FULL';
      }
    } else if (dto.bookingId) {
      // B. Created for an existing pending Booking or balance settlement on confirmed advance booking
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
      });

      if (!booking) {
        throw new NotFoundException(
          `Booking with ID "${dto.bookingId}" not found`,
        );
      }

      if (booking.userId !== userId) {
        throw new ForbiddenException(
          'You cannot pay for another user’s booking',
        );
      }

      if (
        booking.status === BookingStatus.CANCELLED ||
        booking.status === BookingStatus.REFUNDED ||
        booking.status === BookingStatus.EXPIRED
      ) {
        throw new BadRequestException(
          `Cannot pay for a booking in "${booking.status}" status`,
        );
      }

      const remainingAmount = Number(booking.remainingAmount);
      if (remainingAmount <= 0 && booking.paymentStatus === 'PAID') {
        throw new BadRequestException(
          'Booking is already fully paid. No balance due.',
        );
      }

      bookingId = booking.id;
      if (dto.amount) {
        if (dto.amount > remainingAmount && remainingAmount > 0) {
          throw new BadRequestException(
            `Payment amount of ₹${dto.amount} exceeds remaining balance of ₹${remainingAmount}`,
          );
        }
        calculatedAmount = dto.amount;
      } else {
        calculatedAmount =
          remainingAmount > 0 ? remainingAmount : Number(booking.totalPrice);
      }
      paymentType = 'BALANCE';
    } else if (!calculatedAmount) {
      throw new BadRequestException(
        'Either holdId, bookingId, or amount must be provided',
      );
    }

    const paymentNumber = this.generatePaymentNumber();

    // Call payment provider abstraction
    const orderResult = await this.paymentAdapter.createOrder({
      amount: calculatedAmount,
      currency: dto.currency || 'INR',
      orderReference: paymentNumber,
    });

    // Record in database
    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          paymentNumber,
          userId,
          bookingId,
          slotHoldId,
          provider: orderResult.provider,
          orderId: orderResult.orderId,
          amount: calculatedAmount,
          currency: dto.currency || 'INR',
          status: PaymentStatus.PENDING,
          paymentType,
          idempotencyKey: dto.idempotencyKey ?? null,
        },
      });

      await tx.paymentStatusHistory.create({
        data: {
          paymentId: p.id,
          fromStatus: null,
          toStatus: PaymentStatus.PENDING,
          reason: 'Order initiated with payment provider',
        },
      });

      return p;
    });

    return {
      paymentId: payment.id,
      paymentNumber: payment.paymentNumber,
      orderId: orderResult.orderId,
      amount: orderResult.amount,
      currency: orderResult.currency,
      provider: orderResult.provider,
      keyId: orderResult.keyId,
      status: payment.status,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. SERVER-SIDE PAYMENT VERIFICATION
  // ---------------------------------------------------------------------------

  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { orderId: dto.orderId },
          ...(dto.paymentId ? [{ id: dto.paymentId }] : []),
        ],
      },
      include: {
        booking: true,
        slotHold: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(
        `Payment record for order "${dto.orderId}" not found`,
      );
    }

    // CRITICAL: Ownership check — must happen before ANY processing or state mutation
    const isPlatformAdmin =
      // roles are passed via the service call from the controller
      false; // ownership-only path; admins use separate admin endpoints
    if (payment.userId !== userId) {
      this.logger.warn(
        `Security: User ${userId} attempted to verify payment ${payment.id} owned by ${payment.userId}`,
      );
      // Return NOT FOUND to avoid confirming that the orderId exists for another user
      throw new NotFoundException(
        `Payment record for order "${dto.orderId}" not found`,
      );
    }

    // Idempotency: If already confirmed, return success without re-processing
    if (payment.status === PaymentStatus.SUCCESS) {
      return {
        verified: true,
        message: 'Payment already verified and confirmed',
        paymentId: payment.id,
        bookingId: payment.bookingId,
      };
    }

    // 1. Mandatory Server-Side Cryptographic Signature Verification
    // A booking must NEVER be confirmed solely from a Flutter callback!
    const isSignatureValid = await this.paymentAdapter.verifyPayment({
      orderId: dto.orderId,
      transactionId: dto.transactionId,
      signature: dto.signature,
    });

    if (!isSignatureValid) {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failureReason: 'Cryptographic signature verification failed',
            transactionId: dto.transactionId,
            signature: dto.signature,
          },
        });

        await tx.paymentStatusHistory.create({
          data: {
            paymentId: payment.id,
            fromStatus: payment.status,
            toStatus: PaymentStatus.FAILED,
            reason: 'Signature mismatch during server-side verification',
          },
        });
      });

      throw new BadRequestException(
        'Payment signature verification failed. Untrusted or invalid payment callback.',
      );
    }

    // 2. Atomic Transition: Mark Payment SUCCESS + Confirm Booking
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          transactionId: dto.transactionId,
          signature: dto.signature,
        },
      });

      await tx.paymentStatusHistory.create({
        data: {
          paymentId: payment.id,
          fromStatus: PaymentStatus.PENDING,
          toStatus: PaymentStatus.SUCCESS,
          reason: 'Cryptographic signature verified successfully',
        },
      });

      let confirmedBooking = payment.booking;

      // Case A: Confirm from SlotHold
      if (payment.slotHoldId) {
        const hold = await tx.slotHold.findUnique({
          where: { id: payment.slotHoldId },
        });

        if (hold && hold.status === HoldStatus.ACTIVE) {
          const holdDateStr = this.formatDateIso(hold.holdDate);
          const activeSlotKey = `${hold.turfId}_${holdDateStr}_${hold.startTime}`;

          // Acquire advisory lock
          const lockKey = `turf_slot_${hold.turfId}_${holdDateStr}_${hold.startTime}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

          // Mark hold CONVERTED
          await tx.slotHold.update({
            where: { id: hold.id },
            data: { status: HoldStatus.CONVERTED, activeHoldKey: null },
          });

          const paidAmount = Number(payment.amount);
          const holdTotal = Number(hold.totalPrice);
          const isAdvance =
            payment.paymentType === 'ADVANCE' || paidAmount < holdTotal;
          const remainingAmount = Math.max(0, holdTotal - paidAmount);
          const paymentStatus = remainingAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID';

          // Create confirmed booking
          confirmedBooking = await tx.booking.create({
            data: {
              bookingNumber: this.generateBookingNumber(),
              userId: payment.userId,
              turfId: hold.turfId,
              sportId: hold.sportId,
              slotHoldId: hold.id,
              bookingDate: hold.holdDate,
              startTime: hold.startTime,
              endTime: hold.endTime,
              timeSlots: (hold as any).timeSlots,
              status: BookingStatus.CONFIRMED,
              activeSlotKey,
              basePrice: hold.totalPrice,
              totalPrice: hold.totalPrice,
              isAdvanceBooking: isAdvance,
              advanceAmount: isAdvance ? paidAmount : 0,
              paidAmount,
              remainingAmount,
              paymentStatus,
            },
          });

          // Link booking back to payment
          await tx.payment.update({
            where: { id: payment.id },
            data: { bookingId: confirmedBooking.id },
          });

          // Record booking history
          await tx.bookingStatusHistory.create({
            data: {
              bookingId: confirmedBooking.id,
              fromStatus: null,
              toStatus: BookingStatus.CONFIRMED,
              reason: isAdvance
                ? `Advance booking confirmed with initial payment of ₹${paidAmount}. Remaining balance: ₹${remainingAmount}`
                : `Booking confirmed via verified payment ${payment.paymentNumber}`,
              changedByUserId: userId,
            },
          });
        }
      } else if (payment.bookingId) {
        // Case B: Existing Booking (Customer completes balance payment)
        const booking = await tx.booking.findUnique({
          where: { id: payment.bookingId },
        });

        if (booking) {
          const dateStr = this.formatDateIso(booking.bookingDate);
          const activeSlotKey = `${booking.turfId}_${dateStr}_${booking.startTime}`;

          const paymentAmount = Number(payment.amount);
          const prevPaid = Number(booking.paidAmount || 0);
          const newPaid = prevPaid + paymentAmount;
          const newRemaining = Math.max(
            0,
            Number(booking.totalPrice) - newPaid,
          );
          const newPaymentStatus =
            newRemaining <= 0 ? 'PAID' : 'PARTIALLY_PAID';

          confirmedBooking = await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: BookingStatus.CONFIRMED,
              activeSlotKey: booking.activeSlotKey || activeSlotKey,
              paidAmount: newPaid,
              remainingAmount: newRemaining,
              paymentStatus: newPaymentStatus,
            },
          });

          const isFullySettled = newRemaining <= 0;
          await tx.bookingStatusHistory.create({
            data: {
              bookingId: booking.id,
              fromStatus: booking.status,
              toStatus: BookingStatus.CONFIRMED,
              reason: isFullySettled
                ? `Balance payment of ₹${paymentAmount} completed via verified payment ${payment.paymentNumber}. Booking is now fully paid.`
                : `Partial balance payment of ₹${paymentAmount} verified (${payment.paymentNumber}). Remaining balance: ₹${newRemaining}.`,
              changedByUserId: userId,
            },
          });
        }
      }

      return {
        verified: true,
        message: 'Payment verified and booking confirmed successfully',
        payment: updatedPayment,
        booking: confirmedBooking,
      };
    });

    if (this.notificationsService) {
      this.notificationsService
        .notifyPaymentSuccessful({
          id: result.payment.id,
          userId: payment.userId,
          amount: Number(result.payment.amount),
          orderId: result.payment.orderId,
          bookingId: result.booking?.id,
        })
        .catch((err: any) =>
          this.logger.error(`Notification failed: ${err.message}`),
        );

      if (result.booking) {
        this.notificationsService
          .notifyBookingConfirmed(result.booking)
          .catch((err: any) =>
            this.logger.error(`Notification failed: ${err.message}`),
          );
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // 3. PAYMENT INQUIRIES
  // ---------------------------------------------------------------------------

  async getPaymentById(userId: string, userRoles: string[], id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            turf: { select: { id: true, name: true, addressLine: true } },
          },
        },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment record "${id}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);

    if (!isPlatformAdmin && payment.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to view this payment record',
      );
    }

    return payment;
  }

  async getPaymentStatus(userId: string, userRoles: string[], id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      select: {
        id: true,
        paymentNumber: true,
        orderId: true,
        status: true,
        amount: true,
        currency: true,
        userId: true,
        updatedAt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment record "${id}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);

    if (!isPlatformAdmin && payment.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to check this payment status',
      );
    }

    return {
      paymentId: payment.id,
      paymentNumber: payment.paymentNumber,
      orderId: payment.orderId,
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      updatedAt: payment.updatedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. WEBHOOK PROCESSING & DUPLICATE WEBHOOK HANDLING
  // ---------------------------------------------------------------------------

  async handleWebhook(
    rawBody: string,
    headers: Record<string, string>,
    body: any,
  ) {
    // 1. Signature Header Extraction
    const signature =
      headers['x-razorpay-signature'] ||
      headers['stripe-signature'] ||
      headers['x-webhook-signature'] ||
      '';

    // 2. Webhook Signature Verification
    const isWebhookValid = this.paymentAdapter.verifyWebhookSignature({
      rawBody,
      signature,
      secret: '', // Uses configured secret
    });

    if (!isWebhookValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // 3. Parse Webhook Event
    const event = this.paymentAdapter.parseWebhookEvent(body, headers);

    // 4. Duplicate Webhook Handling & Idempotency
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { eventId: event.eventId },
    });

    if (existingEvent) {
      return {
        received: true,
        duplicate: true,
        message: 'Webhook event already processed previously',
      };
    }

    // 5. Atomic Processing
    return this.prisma.$transaction(async (tx) => {
      // Record WebhookEvent
      await tx.webhookEvent.create({
        data: {
          eventId: event.eventId,
          provider: this.paymentAdapter.providerName,
          eventType: event.eventType,
          payload: body,
          status: 'PROCESSED',
        },
      });

      // Handle Event Types
      if (event.eventType === 'payment.captured' && event.orderId) {
        const payment = await tx.payment.findFirst({
          where: { orderId: event.orderId },
          include: { booking: true, slotHold: true },
        });

        if (payment && payment.status !== PaymentStatus.SUCCESS) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.SUCCESS,
              transactionId: event.transactionId || payment.transactionId,
            },
          });

          await tx.paymentStatusHistory.create({
            data: {
              paymentId: payment.id,
              fromStatus: payment.status,
              toStatus: PaymentStatus.SUCCESS,
              reason: 'Webhook confirmed payment capture',
            },
          });

          // Confirm slot hold to booking if not yet done
          if (payment.slotHoldId) {
            const hold = await tx.slotHold.findUnique({
              where: { id: payment.slotHoldId },
            });
            if (hold && hold.status === HoldStatus.ACTIVE) {
              const holdDateStr = this.formatDateIso(hold.holdDate);
              const activeSlotKey = `${hold.turfId}_${holdDateStr}_${hold.startTime}`;

              await tx.slotHold.update({
                where: { id: hold.id },
                data: { status: HoldStatus.CONVERTED, activeHoldKey: null },
              });

              const paidAmount = Number(payment.amount);
              const holdTotal = Number(hold.totalPrice);
              const isAdvance =
                payment.paymentType === 'ADVANCE' || paidAmount < holdTotal;
              const remainingAmount = Math.max(0, holdTotal - paidAmount);
              const paymentStatus =
                remainingAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID';

              const newBooking = await tx.booking.create({
                data: {
                  bookingNumber: this.generateBookingNumber(),
                  userId: payment.userId,
                  turfId: hold.turfId,
                  sportId: hold.sportId,
                  slotHoldId: hold.id,
                  bookingDate: hold.holdDate,
                  startTime: hold.startTime,
                  endTime: hold.endTime,
                  timeSlots: (hold as any).timeSlots,
                  status: BookingStatus.CONFIRMED,
                  activeSlotKey,
                  basePrice: hold.totalPrice,
                  totalPrice: hold.totalPrice,
                  isAdvanceBooking: isAdvance,
                  advanceAmount: isAdvance ? paidAmount : 0,
                  paidAmount,
                  remainingAmount,
                  paymentStatus,
                },
              });

              await tx.payment.update({
                where: { id: payment.id },
                data: { bookingId: newBooking.id },
              });

              await tx.bookingStatusHistory.create({
                data: {
                  bookingId: newBooking.id,
                  fromStatus: null,
                  toStatus: BookingStatus.CONFIRMED,
                  reason: isAdvance
                    ? `Webhook confirmed advance booking (Paid: ₹${paidAmount}, Balance: ₹${remainingAmount})`
                    : 'Webhook payment confirmed booking',
                },
              });
            }
          } else if (payment.bookingId) {
            // Settle balance for existing booking via webhook
            const booking = await tx.booking.findUnique({
              where: { id: payment.bookingId },
            });
            if (booking) {
              const prevPaid = Number(booking.paidAmount || 0);
              const newPaid = prevPaid + Number(payment.amount);
              const newRemaining = Math.max(
                0,
                Number(booking.totalPrice) - newPaid,
              );
              const newPaymentStatus =
                newRemaining <= 0 ? 'PAID' : 'PARTIALLY_PAID';

              await tx.booking.update({
                where: { id: booking.id },
                data: {
                  paidAmount: newPaid,
                  remainingAmount: newRemaining,
                  paymentStatus: newPaymentStatus,
                },
              });

              await tx.bookingStatusHistory.create({
                data: {
                  bookingId: booking.id,
                  fromStatus: booking.status,
                  toStatus: booking.status,
                  reason:
                    newRemaining <= 0
                      ? `Webhook confirmed balance payment of ₹${payment.amount}. Booking fully paid.`
                      : `Webhook confirmed partial balance payment of ₹${payment.amount}. Remaining: ₹${newRemaining}.`,
                },
              });
            }
          }
        }
      } else if (event.eventType === 'payment.failed' && event.orderId) {
        const payment = await tx.payment.findFirst({
          where: { orderId: event.orderId },
        });

        if (payment && payment.status !== PaymentStatus.SUCCESS) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.FAILED,
              failureReason: event.failureReason || 'Payment failed at gateway',
            },
          });

          await tx.paymentStatusHistory.create({
            data: {
              paymentId: payment.id,
              fromStatus: payment.status,
              toStatus: PaymentStatus.FAILED,
              reason:
                event.failureReason || 'Webhook notification: payment failed',
            },
          });
        }
      }

      return {
        received: true,
        eventId: event.eventId,
        status: 'PROCESSED',
      };
    });
  }
}
