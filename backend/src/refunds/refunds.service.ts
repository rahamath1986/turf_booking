import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConfigurablePaymentAdapter } from '../payments/adapters/configurable-payment.adapter';
import { Role } from '../common/enums/role.enum';
import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
  RefundType,
} from '@prisma/client';
import { ProcessRefundResult } from '../payments/interfaces/payment-provider.interface';
import {
  CancellationCalculationResult,
  DEFAULT_CANCELLATION_POLICY,
  TurfCancellationPolicyConfig,
} from './interfaces/cancellation-policy.interface';
import { CreateRefundDto } from './dto/create-refund.dto';
import { CancelBookingDto } from '../bookings/dto/cancel-booking.dto';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentAdapter: ConfigurablePaymentAdapter,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  /**
   * GET /api/v1/turfs/:id/cancellation-policy
   * Retrieves the cancellation policy for a turf (or system default if not customized).
   */
  async getTurfCancellationPolicy(
    turfId: string,
  ): Promise<TurfCancellationPolicyConfig> {
    const turf = await this.prisma.turf.findUnique({
      where: { id: turfId },
      include: {
        cancellationPolicyRule: true,
      },
    });

    if (!turf) {
      throw new NotFoundException(`Turf with ID "${turfId}" not found`);
    }

    if (turf.cancellationPolicyRule) {
      const customRules = Array.isArray(turf.cancellationPolicyRule.rules)
        ? (turf.cancellationPolicyRule.rules as any[])
        : DEFAULT_CANCELLATION_POLICY.rules;

      return {
        turfId: turf.id,
        freeCancellationHours:
          turf.cancellationPolicyRule.freeCancellationHours,
        fixedCancellationFee: Number(
          turf.cancellationPolicyRule.fixedCancellationFee,
        ),
        rules: customRules,
        description:
          turf.cancellationPolicyRule.description ||
          turf.cancellationPolicy ||
          DEFAULT_CANCELLATION_POLICY.description,
      };
    }

    return {
      turfId: turf.id,
      freeCancellationHours: DEFAULT_CANCELLATION_POLICY.freeCancellationHours,
      fixedCancellationFee: DEFAULT_CANCELLATION_POLICY.fixedCancellationFee,
      rules: DEFAULT_CANCELLATION_POLICY.rules,
      description:
        turf.cancellationPolicy || DEFAULT_CANCELLATION_POLICY.description,
    };
  }

  /**
   * Calculates cancellation fee and refund amounts server-side.
   */
  calculateCancellationValues(
    totalPrice: number,
    amountPaid: number,
    hoursRemaining: number,
    policy: TurfCancellationPolicyConfig,
  ): {
    cancellationFee: number;
    refundAmount: number;
    refundPercentage: number;
    refundType: RefundType;
    policyApplied: string;
    isEligibleForRefund: boolean;
  } {
    if (amountPaid <= 0) {
      return {
        cancellationFee: 0,
        refundAmount: 0,
        refundPercentage: 0,
        refundType: RefundType.NONE,
        policyApplied: 'No payment made. No refund applicable.',
        isEligibleForRefund: false,
      };
    }

    // Sort tiers in descending order of minHoursBefore
    const sortedTiers = [...policy.rules].sort(
      (a, b) => b.minHoursBefore - a.minHoursBefore,
    );

    // Find the first tier where hoursRemaining >= minHoursBefore
    const matchedTier = sortedTiers.find(
      (tier) => hoursRemaining >= tier.minHoursBefore,
    );

    let refundPercentage = 0;
    let fixedFee = policy.fixedCancellationFee || 0;
    let policyApplied = 'No refund policy matched';

    if (matchedTier) {
      refundPercentage = matchedTier.refundPercentage;
      if (matchedTier.fixedFee !== undefined) {
        fixedFee = matchedTier.fixedFee;
      }
      policyApplied =
        matchedTier.description ||
        `Tier applied for ${matchedTier.minHoursBefore}h+ prior (${refundPercentage}% refund)`;
    } else {
      // Past game time or zero tier
      refundPercentage = 0;
      policyApplied = 'Non-refundable: Slot time has passed or started.';
    }

    // Calculate refund and fee
    const grossRefund = (amountPaid * refundPercentage) / 100;
    let netRefund = Math.max(0, grossRefund - fixedFee);
    netRefund = Math.min(amountPaid, netRefund);

    const cancellationFee = Math.max(0, amountPaid - netRefund);

    let refundType: RefundType = RefundType.NONE;
    if (netRefund >= amountPaid) {
      refundType = RefundType.FULL;
    } else if (netRefund > 0) {
      refundType = RefundType.PARTIAL;
    } else {
      refundType = RefundType.NONE;
    }

    return {
      cancellationFee: Number(cancellationFee.toFixed(2)),
      refundAmount: Number(netRefund.toFixed(2)),
      refundPercentage,
      refundType,
      policyApplied,
      isEligibleForRefund: netRefund > 0,
    };
  }

  /**
   * Helper: parses slot start time and calculates remaining hours
   */
  getRemainingHours(
    bookingDate: Date,
    startTime: string,
    referenceTime: Date = new Date(),
  ): number {
    const [hours, minutes] = startTime.split(':').map(Number);
    const slotStart = new Date(bookingDate);
    slotStart.setHours(hours, minutes, 0, 0);

    const diffMs = slotStart.getTime() - referenceTime.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
  }

  /**
   * GET /api/v1/bookings/:id/cancellation-fee
   * Computes the exact cancellation fee for a booking.
   */
  async calculateCancellationFee(
    userId: string,
    userRoles: string[],
    bookingId: string,
    referenceTime?: Date,
  ): Promise<CancellationCalculationResult> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        turf: {
          include: {
            owner: true,
            cancellationPolicyRule: true,
          },
        },
        payments: {
          where: { status: PaymentStatus.SUCCESS },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID "${bookingId}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);
    const isTurfOwner = booking.turf.owner.userId === userId;
    const isBookingCustomer = booking.userId === userId;

    if (!isPlatformAdmin && !isTurfOwner && !isBookingCustomer) {
      throw new ForbiddenException(
        'You are not authorized to view this booking cancellation fee',
      );
    }

    const policy = await this.getTurfCancellationPolicy(booking.turfId);
    const hoursRemaining = this.getRemainingHours(
      booking.bookingDate,
      booking.startTime,
      referenceTime,
    );

    const totalPrice = Number(booking.totalPrice);
    const amountPaid = booking.payments.reduce(
      (sum: number, p: any) => sum + Number(p.amount),
      0,
    );

    const calc = this.calculateCancellationValues(
      totalPrice,
      amountPaid,
      hoursRemaining,
      policy,
    );

    return {
      bookingId: booking.id,
      totalPrice,
      amountPaid,
      hoursRemaining: Number(hoursRemaining.toFixed(2)),
      cancellationFee: calc.cancellationFee,
      refundAmount: calc.refundAmount,
      refundPercentage: calc.refundPercentage,
      refundType: calc.refundType,
      policyApplied: calc.policyApplied,
      isEligibleForRefund: calc.isEligibleForRefund,
    };
  }

  /**
   * GET /api/v1/bookings/:id/refund-preview
   * Detailed breakdown preview before the user or admin confirms cancellation.
   */
  async getRefundPreview(
    userId: string,
    userRoles: string[],
    bookingId: string,
    referenceTime?: Date,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        turf: {
          include: {
            owner: true,
            cancellationPolicyRule: true,
          },
        },
        payments: {
          where: { status: PaymentStatus.SUCCESS },
        },
        refunds: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID "${bookingId}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);
    const isTurfOwner = booking.turf.owner.userId === userId;
    const isBookingCustomer = booking.userId === userId;

    if (!isPlatformAdmin && !isTurfOwner && !isBookingCustomer) {
      throw new ForbiddenException(
        'You are not authorized to preview this refund',
      );
    }

    const policy = await this.getTurfCancellationPolicy(booking.turfId);
    const hoursRemaining = this.getRemainingHours(
      booking.bookingDate,
      booking.startTime,
      referenceTime,
    );

    const totalPrice = Number(booking.totalPrice);
    const amountPaid = booking.payments.reduce(
      (sum: number, p: any) => sum + Number(p.amount),
      0,
    );
    const previousRefunds = booking.refunds
      .filter((r: any) => r.status === RefundStatus.COMPLETED)
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0);

    const netAmountAvailable = Math.max(0, amountPaid - previousRefunds);

    const calc = this.calculateCancellationValues(
      totalPrice,
      netAmountAvailable,
      hoursRemaining,
      policy,
    );

    return {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      bookingDate: booking.bookingDate.toISOString().split('T')[0],
      startTime: booking.startTime,
      endTime: booking.endTime,
      bookingStatus: booking.status,
      hoursRemaining: Number(hoursRemaining.toFixed(2)),
      financials: {
        totalPrice,
        amountPaid,
        previousRefunds,
        netPaidRemaining: netAmountAvailable,
        cancellationFee: calc.cancellationFee,
        estimatedRefundAmount: calc.refundAmount,
        refundPercentage: calc.refundPercentage,
        refundType: calc.refundType,
        isEligibleForRefund: calc.isEligibleForRefund,
      },
      policyDetails: {
        freeCancellationHours: policy.freeCancellationHours,
        fixedCancellationFee: policy.fixedCancellationFee,
        ruleApplied: calc.policyApplied,
      },
    };
  }

  /**
   * POST /api/v1/bookings/:id/cancel
   * Cancels the booking, frees active slot lock, and initiates refund if eligible.
   */
  async cancelBookingWithRefund(
    userId: string,
    userRoles: string[],
    bookingId: string,
    dto: CancelBookingDto,
    referenceTime?: Date,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        turf: {
          include: {
            owner: true,
            cancellationPolicyRule: true,
          },
        },
        payments: {
          where: { status: PaymentStatus.SUCCESS },
          orderBy: { createdAt: 'desc' },
        },
        refunds: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID "${bookingId}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);
    const isTurfOwner = booking.turf.owner.userId === userId;
    const isBookingCustomer = booking.userId === userId;

    if (!isPlatformAdmin && !isTurfOwner && !isBookingCustomer) {
      throw new ForbiddenException(
        'You are not authorized to cancel this booking',
      );
    }

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.REFUNDED
    ) {
      throw new BadRequestException(
        `Cannot cancel a booking in "${booking.status}" status`,
      );
    }

    const policy = await this.getTurfCancellationPolicy(booking.turfId);
    const hoursRemaining = this.getRemainingHours(
      booking.bookingDate,
      booking.startTime,
      referenceTime,
    );

    const totalPrice = Number(booking.totalPrice);
    const amountPaid = booking.payments.reduce(
      (sum: number, p: any) => sum + Number(p.amount),
      0,
    );
    const successfulPayment = booking.payments[0] || null;

    const calc = this.calculateCancellationValues(
      totalPrice,
      amountPaid,
      hoursRemaining,
      policy,
    );

    // Atomically execute cancellation and refund records
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Cancel booking and release slot
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status:
            calc.refundType === RefundType.FULL
              ? BookingStatus.REFUNDED
              : calc.refundType === RefundType.PARTIAL
                ? BookingStatus.PARTIALLY_REFUNDED
                : BookingStatus.CANCELLED,
          activeSlotKey: null, // Frees the slot immediately!
          cancellationReason: dto.reason || 'User cancelled',
          cancelledAt: new Date(),
        },
      });

      // 2. Audit transition in booking status history
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: booking.status,
          toStatus: updatedBooking.status,
          reason: dto.reason || 'Customer cancellation',
          changedByUserId: userId,
        },
      });

      let refundRecord: any = null;

      // 3. If there is a payment and refund amount > 0, process refund
      if (successfulPayment && calc.refundAmount > 0) {
        const refundNumber = `RFND-${Date.now().toString().slice(-8)}`;

        // Call payment provider adapter
        let gatewayResult: ProcessRefundResult = {
          gatewayRefundId: `rfnd_${Date.now()}`,
          status: 'COMPLETED',
          amount: calc.refundAmount,
        };

        try {
          if (successfulPayment.transactionId) {
            gatewayResult = await this.paymentAdapter.processRefund({
              transactionId: successfulPayment.transactionId,
              orderId: successfulPayment.orderId,
              amount: calc.refundAmount,
              reason: dto.reason || 'Booking cancellation refund',
            });
          }
        } catch (err: any) {
          this.logger.error(`Gateway refund failed: ${err.message}`);
          gatewayResult = {
            gatewayRefundId: `failed_${Date.now()}`,
            status: 'FAILED',
            amount: calc.refundAmount,
            failureReason: err.message,
          };
        }

        const refundDbStatus =
          gatewayResult.status === 'COMPLETED'
            ? RefundStatus.COMPLETED
            : gatewayResult.status === 'PENDING'
              ? RefundStatus.PENDING
              : RefundStatus.FAILED;

        refundRecord = await tx.refund.create({
          data: {
            refundNumber,
            bookingId,
            paymentId: successfulPayment.id,
            userId: booking.userId,
            amount: calc.refundAmount,
            cancellationFee: calc.cancellationFee,
            refundPercentage: calc.refundPercentage,
            refundType: calc.refundType,
            status: refundDbStatus,
            gatewayRefundId: gatewayResult.gatewayRefundId,
            reason: dto.reason || 'Booking cancellation refund',
            processedAt:
              refundDbStatus === RefundStatus.COMPLETED ? new Date() : null,
          },
        });

        // Update payment status if completed
        if (refundDbStatus === RefundStatus.COMPLETED) {
          const newPaymentStatus =
            calc.refundType === RefundType.FULL
              ? PaymentStatus.REFUNDED
              : PaymentStatus.PARTIALLY_REFUNDED;

          await tx.payment.update({
            where: { id: successfulPayment.id },
            data: { status: newPaymentStatus },
          });

          await tx.paymentStatusHistory.create({
            data: {
              paymentId: successfulPayment.id,
              fromStatus: successfulPayment.status,
              toStatus: newPaymentStatus,
              reason: `Refund of ₹${calc.refundAmount} issued. Type: ${calc.refundType}`,
            },
          });
        }
      }

      if (this.notificationsService) {
        this.notificationsService
          .notifyBookingCancelled(booking)
          .catch((err: any) =>
            this.logger.error(`Notification failed: ${err.message}`),
          );

        if (refundRecord && refundRecord.status === RefundStatus.COMPLETED) {
          this.notificationsService
            .notifyRefundCompleted(refundRecord)
            .catch((err: any) =>
              this.logger.error(`Notification failed: ${err.message}`),
            );
        } else if (refundRecord) {
          this.notificationsService
            .notifyRefundInitiated(refundRecord)
            .catch((err: any) =>
              this.logger.error(`Notification failed: ${err.message}`),
            );
        }
      }

      return {
        ...updatedBooking,
        booking: updatedBooking,
        cancellation: {
          hoursRemaining: Number(hoursRemaining.toFixed(2)),
          cancellationFee: calc.cancellationFee,
          refundAmount: calc.refundAmount,
          refundPercentage: calc.refundPercentage,
          refundType: calc.refundType,
          policyApplied: calc.policyApplied,
        },
        refund: refundRecord,
      };
    });
  }

  /**
   * POST /api/v1/refunds
   * Explicitly issues a refund for a booking.
   */
  async createRefund(
    userId: string,
    userRoles: string[],
    dto: CreateRefundDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        turf: {
          include: {
            owner: true,
            cancellationPolicyRule: true,
          },
        },
        payments: {
          where: { status: PaymentStatus.SUCCESS },
          orderBy: { createdAt: 'desc' },
        },
        refunds: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(
        `Booking with ID "${dto.bookingId}" not found`,
      );
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);
    const isTurfOwner = booking.turf.owner.userId === userId;

    if (!isPlatformAdmin && !isTurfOwner) {
      throw new ForbiddenException(
        'Only turf owners or administrators can initiate direct refunds',
      );
    }

    if (booking.payments.length === 0) {
      throw new BadRequestException(
        'Cannot issue refund: Booking has no successful payments',
      );
    }

    const successfulPayment = booking.payments[0];
    const totalPaid = booking.payments.reduce(
      (sum: number, p: any) => sum + Number(p.amount),
      0,
    );

    const previousRefunds = booking.refunds
      .filter(
        (r: any) =>
          r.status === RefundStatus.COMPLETED ||
          r.status === RefundStatus.PENDING,
      )
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0);

    const maxRefundable = Math.max(0, totalPaid - previousRefunds);
    if (maxRefundable <= 0) {
      throw new BadRequestException('Booking is already fully refunded');
    }

    let refundAmount = maxRefundable;
    let cancellationFee = 0;
    let refundPercentage = 100;
    let refundType: RefundType = RefundType.FULL;

    if (dto.amount !== undefined) {
      if (dto.amount <= 0 || dto.amount > maxRefundable) {
        throw new BadRequestException(
          `Refund amount must be between 1 and ${maxRefundable}`,
        );
      }
      refundAmount = dto.amount;
      cancellationFee = Math.max(0, totalPaid - refundAmount);
      refundPercentage = Number(((refundAmount / totalPaid) * 100).toFixed(2));
      refundType =
        refundAmount >= maxRefundable ? RefundType.FULL : RefundType.PARTIAL;
    } else {
      // Server-side calculation
      const policy = await this.getTurfCancellationPolicy(booking.turfId);
      const hoursRemaining = this.getRemainingHours(
        booking.bookingDate,
        booking.startTime,
      );
      const calc = this.calculateCancellationValues(
        Number(booking.totalPrice),
        maxRefundable,
        hoursRemaining,
        policy,
      );

      refundAmount = Math.min(calc.refundAmount, maxRefundable);
      cancellationFee = calc.cancellationFee;
      refundPercentage = calc.refundPercentage;
      refundType = calc.refundType;
    }

    if (refundAmount <= 0) {
      throw new BadRequestException(
        'Calculated refund amount is ₹0 based on policy or previous refunds',
      );
    }

    // Call payment provider adapter
    let gatewayResult: ProcessRefundResult = {
      gatewayRefundId: `rfnd_${Date.now()}`,
      status: 'COMPLETED',
      amount: refundAmount,
    };

    try {
      if (successfulPayment.transactionId) {
        gatewayResult = await this.paymentAdapter.processRefund({
          transactionId: successfulPayment.transactionId,
          orderId: successfulPayment.orderId,
          amount: refundAmount,
          reason: dto.reason || 'Manual refund',
        });
      }
    } catch (err: any) {
      this.logger.error(`Gateway refund failed: ${err.message}`);
      gatewayResult = {
        gatewayRefundId: `rfnd_failed_${Date.now()}`,
        status: 'FAILED',
        amount: refundAmount,
        failureReason: err.message,
      };
    }

    const refundDbStatus =
      gatewayResult.status === 'COMPLETED'
        ? RefundStatus.COMPLETED
        : gatewayResult.status === 'PENDING'
          ? RefundStatus.PENDING
          : RefundStatus.FAILED;

    const refundNumber = `RFND-${Date.now().toString().slice(-8)}`;

    const refundRecord = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const refund = await tx.refund.create({
          data: {
            refundNumber,
            bookingId: booking.id,
            paymentId: successfulPayment.id,
            userId: booking.userId,
            amount: refundAmount,
            cancellationFee,
            refundPercentage,
            refundType,
            status: refundDbStatus,
            gatewayRefundId: gatewayResult.gatewayRefundId,
            reason: dto.reason || 'Admin / Owner issued refund',
            processedAt:
              refundDbStatus === RefundStatus.COMPLETED ? new Date() : null,
          },
        });

        if (refundDbStatus === RefundStatus.COMPLETED) {
          const totalNowRefunded = previousRefunds + refundAmount;
          const isFull = totalNowRefunded >= totalPaid;

          const newPaymentStatus = isFull
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PARTIALLY_REFUNDED;
          const newBookingStatus = isFull
            ? BookingStatus.REFUNDED
            : BookingStatus.PARTIALLY_REFUNDED;

          await tx.payment.update({
            where: { id: successfulPayment.id },
            data: { status: newPaymentStatus },
          });

          await tx.paymentStatusHistory.create({
            data: {
              paymentId: successfulPayment.id,
              fromStatus: successfulPayment.status,
              toStatus: newPaymentStatus,
              reason: `Refund issued: ₹${refundAmount}`,
            },
          });

          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: newBookingStatus,
              activeSlotKey: null,
            },
          });

          await tx.bookingStatusHistory.create({
            data: {
              bookingId: booking.id,
              fromStatus: booking.status,
              toStatus: newBookingStatus,
              reason: `Refund processed: ₹${refundAmount}`,
              changedByUserId: userId,
            },
          });
        }

        return refund;
      },
    );

    if (this.notificationsService) {
      if (refundRecord.status === RefundStatus.COMPLETED) {
        this.notificationsService
          .notifyRefundCompleted(refundRecord)
          .catch((err: any) =>
            this.logger.error(`Notification failed: ${err.message}`),
          );
      } else {
        this.notificationsService
          .notifyRefundInitiated(refundRecord)
          .catch((err: any) =>
            this.logger.error(`Notification failed: ${err.message}`),
          );
      }
    }

    return refundRecord;
  }

  /**
   * GET /api/v1/refunds/:id
   * Retrieves refund details by ID.
   */
  async getRefundById(userId: string, userRoles: string[], id: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            turf: {
              include: {
                owner: true,
              },
            },
          },
        },
        payment: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException(`Refund with ID "${id}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);
    const isTurfOwner = refund.booking.turf.owner.userId === userId;
    const isRefundCustomer = refund.userId === userId;

    if (!isPlatformAdmin && !isTurfOwner && !isRefundCustomer) {
      throw new ForbiddenException(
        'You are not authorized to view this refund',
      );
    }

    return refund;
  }
}
