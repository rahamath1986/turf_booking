import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FcmNotificationAdapter } from './adapters/fcm-notification.adapter';
import { NotificationType } from '@prisma/client';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushAdapter: FcmNotificationAdapter,
  ) {}

  // ===========================================================================
  // DEVICE TOKEN MANAGEMENT
  // ===========================================================================

  /**
   * POST /api/v1/devices
   * Registers or updates a device push token for an authenticated user.
   */
  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const device = await this.prisma.userDevice.upsert({
      where: { deviceToken: dto.deviceToken },
      update: {
        userId,
        deviceType: dto.deviceType,
        deviceName: dto.deviceName,
        osVersion: dto.osVersion,
        appVersion: dto.appVersion,
        isActive: true,
        lastActiveAt: new Date(),
      },
      create: {
        userId,
        deviceToken: dto.deviceToken,
        deviceType: dto.deviceType,
        deviceName: dto.deviceName,
        osVersion: dto.osVersion,
        appVersion: dto.appVersion,
        isActive: true,
        lastActiveAt: new Date(),
      },
    });

    this.logger.log(
      `Registered device "${device.deviceType}" (${device.id}) for user "${userId}"`,
    );

    return device;
  }

  /**
   * DELETE /api/v1/devices/:id
   * Removes / unregisters a device token (e.g., on logout or app uninstall).
   */
  async unregisterDevice(
    userId: string,
    userRoles: string[],
    deviceId: string,
  ) {
    const device = await this.prisma.userDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException(`Device with ID "${deviceId}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);
    if (!isPlatformAdmin && device.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to unregister this device',
      );
    }

    await this.prisma.userDevice.delete({
      where: { id: deviceId },
    });

    this.logger.log(`Unregistered device "${deviceId}" for user "${userId}"`);

    return {
      success: true,
      message: 'Device unregistered successfully',
    };
  }

  // ===========================================================================
  // NOTIFICATION INBOX MANAGEMENT
  // ===========================================================================

  /**
   * GET /api/v1/notifications
   * Retrieves paginated notifications for the authenticated user.
   */
  async getUserNotifications(userId: string, query: NotificationQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }
    if (query.type) {
      where.type = query.type;
    }

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  }

  /**
   * GET /api/v1/notifications/unread
   * Returns unread notifications and the quick badge counter.
   */
  async getUnreadNotifications(userId: string) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      unreadCount,
      items,
    };
  }

  /**
   * POST /api/v1/notifications/:id/read
   * Marks a single notification as read.
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID "${notificationId}" not found`,
      );
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to update this notification',
      );
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * POST /api/v1/notifications/read-all
   * Marks all unread notifications for the user as read.
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      success: true,
      markedReadCount: result.count,
    };
  }

  // ===========================================================================
  // NOTIFICATION DISPATCH ENGINE (In-App + FCM Push)
  // ===========================================================================

  /**
   * Persists an in-app notification and dispatches push notifications to active user devices.
   */
  async sendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    // 1. Persist notification in database
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data: data || {},
      },
    });

    // 2. Fetch active devices for push delivery
    try {
      const activeDevices = await this.prisma.userDevice.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: { deviceToken: true },
      });

      const tokens = activeDevices.map((d) => d.deviceToken);
      if (tokens.length > 0) {
        const stringData: Record<string, string> = {
          notificationId: notification.id,
          type,
        };
        if (data) {
          for (const [k, v] of Object.entries(data)) {
            stringData[k] = typeof v === 'string' ? v : JSON.stringify(v);
          }
        }

        await this.pushAdapter.sendPush({
          tokens,
          title,
          body,
          data: stringData,
        });
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to deliver push notification to user ${userId}: ${err.message}`,
      );
    }

    return notification;
  }

  // ===========================================================================
  // SPECIALIZED NOTIFICATION TRIGGERS
  // ===========================================================================

  /**
   * 1. Booking Confirmed
   * Notifies the customer and notifies the turf owner.
   */
  async notifyBookingConfirmed(booking: {
    id: string;
    bookingNumber: string;
    userId: string;
    bookingDate: Date;
    startTime: string;
    turf?: { name: string; owner?: { userId: string } };
  }) {
    const turfName = booking.turf?.name || 'Sports Turf';
    const dateStr = new Date(booking.bookingDate).toISOString().split('T')[0];

    // Notify Customer
    await this.sendNotification(
      booking.userId,
      NotificationType.BOOKING_CONFIRMED,
      'Booking Confirmed! 🏟️',
      `Your booking #${booking.bookingNumber} for ${turfName} on ${dateStr} at ${booking.startTime} is confirmed!`,
      { bookingId: booking.id, bookingNumber: booking.bookingNumber },
    );

    // Notify Turf Owner if present
    if (booking.turf?.owner?.userId) {
      await this.sendNotification(
        booking.turf.owner.userId,
        NotificationType.OWNER_BOOKING_NOTIFICATION,
        'New Booking Received! ⚽',
        `New booking #${booking.bookingNumber} at ${turfName} on ${dateStr} at ${booking.startTime}.`,
        { bookingId: booking.id, bookingNumber: booking.bookingNumber },
      );
    }
  }

  /**
   * 2. Payment Successful
   */
  async notifyPaymentSuccessful(payment: {
    id: string;
    userId: string;
    amount: number | string;
    orderId: string;
    bookingId?: string | null;
  }) {
    await this.sendNotification(
      payment.userId,
      NotificationType.PAYMENT_SUCCESSFUL,
      'Payment Successful 💳',
      `Payment of ₹${payment.amount} was successfully verified and processed.`,
      {
        paymentId: payment.id,
        orderId: payment.orderId,
        bookingId: payment.bookingId || '',
      },
    );
  }

  /**
   * 3. Booking Cancelled
   */
  async notifyBookingCancelled(booking: {
    id: string;
    bookingNumber: string;
    userId: string;
    turf?: { name: string; owner?: { userId: string } };
    cancellationReason?: string | null;
  }) {
    const turfName = booking.turf?.name || 'Venue';
    const reasonText = booking.cancellationReason
      ? ` Reason: ${booking.cancellationReason}`
      : '';

    // Notify Customer
    await this.sendNotification(
      booking.userId,
      NotificationType.BOOKING_CANCELLED,
      'Booking Cancelled',
      `Your booking #${booking.bookingNumber} for ${turfName} has been cancelled.${reasonText}`,
      { bookingId: booking.id, bookingNumber: booking.bookingNumber },
    );

    // Notify Owner
    if (booking.turf?.owner?.userId) {
      await this.sendNotification(
        booking.turf.owner.userId,
        NotificationType.OWNER_BOOKING_NOTIFICATION,
        'Booking Cancelled by Customer',
        `Booking #${booking.bookingNumber} at ${turfName} was cancelled.${reasonText}`,
        { bookingId: booking.id, bookingNumber: booking.bookingNumber },
      );
    }
  }

  /**
   * 4. Booking Reminder
   */
  async notifyBookingReminder(booking: {
    id: string;
    bookingNumber: string;
    userId: string;
    startTime: string;
    turf?: { name: string };
  }) {
    const turfName = booking.turf?.name || 'Turf';
    await this.sendNotification(
      booking.userId,
      NotificationType.BOOKING_REMINDER,
      'Match Reminder ⏰',
      `Your match at ${turfName} starts soon at ${booking.startTime}! Get ready to play.`,
      { bookingId: booking.id, bookingNumber: booking.bookingNumber },
    );
  }

  /**
   * 5. Refund Initiated
   */
  async notifyRefundInitiated(refund: {
    id: string;
    userId: string;
    amount: any;
    refundNumber: string;
    bookingId: string;
  }) {
    await this.sendNotification(
      refund.userId,
      NotificationType.REFUND_INITIATED,
      'Refund Initiated 🔄',
      `A refund of ₹${Number(refund.amount)} (#${refund.refundNumber}) has been initiated to your original payment method.`,
      { refundId: refund.id, bookingId: refund.bookingId },
    );
  }

  /**
   * 6. Refund Completed
   */
  async notifyRefundCompleted(refund: {
    id: string;
    userId: string;
    amount: any;
    refundNumber: string;
    bookingId: string;
  }) {
    await this.sendNotification(
      refund.userId,
      NotificationType.REFUND_COMPLETED,
      'Refund Completed ✅',
      `Your refund of ₹${Number(refund.amount)} (#${refund.refundNumber}) has completed successfully.`,
      { refundId: refund.id, bookingId: refund.bookingId },
    );
  }

  /**
   * 7. Owner Booking Notification
   */
  async notifyOwnerBooking(
    ownerUserId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    return this.sendNotification(
      ownerUserId,
      NotificationType.OWNER_BOOKING_NOTIFICATION,
      title,
      body,
      data,
    );
  }
}
