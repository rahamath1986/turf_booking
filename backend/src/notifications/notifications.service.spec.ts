import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../database/prisma.service';
import { FcmNotificationAdapter } from './adapters/fcm-notification.adapter';
import { NotificationType } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let pushAdapter: any;

  const mockUserId = 'user-uuid-1';
  const mockOwnerId = 'owner-uuid-1';
  const mockDeviceId = 'device-uuid-1';
  const mockNotificationId = 'notification-uuid-1';

  beforeEach(async () => {
    prisma = {
      userDevice: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    pushAdapter = {
      providerName: 'FCM',
      sendPush: jest.fn().mockResolvedValue({
        success: true,
        successCount: 1,
        failureCount: 0,
        provider: 'FCM',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: FcmNotificationAdapter, useValue: pushAdapter },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('Device Registration & Management', () => {
    it('POST /api/v1/devices -> should upsert and activate device FCM token', async () => {
      const mockDevice = {
        id: mockDeviceId,
        userId: mockUserId,
        deviceToken: 'fcm_token_123',
        deviceType: 'ANDROID',
        isActive: true,
      };

      prisma.userDevice.upsert.mockResolvedValue(mockDevice);

      const result = await service.registerDevice(mockUserId, {
        deviceToken: 'fcm_token_123',
        deviceType: 'ANDROID',
        deviceName: 'Pixel 8',
      });

      expect(result).toEqual(mockDevice);
      expect(prisma.userDevice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deviceToken: 'fcm_token_123' },
          create: expect.objectContaining({
            userId: mockUserId,
            deviceToken: 'fcm_token_123',
            isActive: true,
          }),
        }),
      );
    });

    it('DELETE /api/v1/devices/:id -> should unregister device for device owner', async () => {
      prisma.userDevice.findUnique.mockResolvedValue({
        id: mockDeviceId,
        userId: mockUserId,
      });
      prisma.userDevice.delete.mockResolvedValue({});

      const result = await service.unregisterDevice(
        mockUserId,
        ['CUSTOMER'],
        mockDeviceId,
      );

      expect(result.success).toBe(true);
      expect(prisma.userDevice.delete).toHaveBeenCalledWith({
        where: { id: mockDeviceId },
      });
    });

    it('DELETE /api/v1/devices/:id -> should reject unregister attempt by unauthorized user', async () => {
      prisma.userDevice.findUnique.mockResolvedValue({
        id: mockDeviceId,
        userId: 'other-user',
      });

      await expect(
        service.unregisterDevice(mockUserId, ['CUSTOMER'], mockDeviceId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('DELETE /api/v1/devices/:id -> should throw NotFoundException for invalid device id', async () => {
      prisma.userDevice.findUnique.mockResolvedValue(null);

      await expect(
        service.unregisterDevice(mockUserId, ['CUSTOMER'], 'unknown-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Notifications Inbox Management', () => {
    it('GET /api/v1/notifications -> should return paginated list and unread count', async () => {
      const mockNotifications = [
        { id: '1', title: 'Booking Confirmed', isRead: false },
        { id: '2', title: 'Payment Success', isRead: true },
      ];

      prisma.notification.findMany.mockResolvedValue(mockNotifications);
      prisma.notification.count
        .mockResolvedValueOnce(2) // total
        .mockResolvedValueOnce(1); // unreadCount

      const result = await service.getUserNotifications(mockUserId, {
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.unreadCount).toBe(1);
    });

    it('GET /api/v1/notifications/unread -> should return unread items and badge count', async () => {
      prisma.notification.findMany.mockResolvedValue([
        { id: '1', title: 'Reminder', isRead: false },
      ]);
      prisma.notification.count.mockResolvedValue(1);

      const result = await service.getUnreadNotifications(mockUserId);
      expect(result.unreadCount).toBe(1);
      expect(result.items).toHaveLength(1);
    });

    it('POST /api/v1/notifications/:id/read -> should mark single notification as read', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: mockNotificationId,
        userId: mockUserId,
        isRead: false,
      });
      prisma.notification.update.mockResolvedValue({
        id: mockNotificationId,
        isRead: true,
        readAt: new Date(),
      });

      const result = await service.markAsRead(mockUserId, mockNotificationId);
      expect(result.isRead).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockNotificationId },
          data: expect.objectContaining({ isRead: true }),
        }),
      );
    });

    it('POST /api/v1/notifications/read-all -> should mark all unread notifications as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead(mockUserId);
      expect(result.success).toBe(true);
      expect(result.markedReadCount).toBe(5);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId, isRead: false },
          data: expect.objectContaining({ isRead: true }),
        }),
      );
    });
  });

  describe('Specialized Notification Event Triggers', () => {
    beforeEach(() => {
      prisma.userDevice.findMany.mockResolvedValue([
        { deviceToken: 'token_device_abc' },
      ]);
      prisma.notification.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'new-notif-id', ...data }),
      );
    });

    it('notifyBookingConfirmed -> notifies customer and turf owner', async () => {
      await service.notifyBookingConfirmed({
        id: 'b-1',
        bookingNumber: 'TB-2026-001',
        userId: mockUserId,
        bookingDate: new Date('2026-11-20'),
        startTime: '18:00',
        turf: {
          name: 'Super Turf',
          owner: { userId: mockOwnerId },
        },
      });

      // Assert in-app notifications created for both customer and owner
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.BOOKING_CONFIRMED,
          }),
        }),
      );
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockOwnerId,
            type: NotificationType.OWNER_BOOKING_NOTIFICATION,
          }),
        }),
      );

      // Assert push notification was sent via adapter
      expect(pushAdapter.sendPush).toHaveBeenCalled();
    });

    it('notifyPaymentSuccessful -> sends payment confirmation notification', async () => {
      await service.notifyPaymentSuccessful({
        id: 'p-1',
        userId: mockUserId,
        amount: 1400,
        orderId: 'order_123',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.PAYMENT_SUCCESSFUL,
          }),
        }),
      );
    });

    it('notifyBookingCancelled -> sends cancellation notice to customer and owner', async () => {
      await service.notifyBookingCancelled({
        id: 'b-1',
        bookingNumber: 'TB-2026-001',
        userId: mockUserId,
        turf: {
          name: 'Super Turf',
          owner: { userId: mockOwnerId },
        },
        cancellationReason: 'Rain',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.BOOKING_CANCELLED,
          }),
        }),
      );
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockOwnerId,
            type: NotificationType.OWNER_BOOKING_NOTIFICATION,
          }),
        }),
      );
    });

    it('notifyBookingReminder -> sends match reminder notification', async () => {
      await service.notifyBookingReminder({
        id: 'b-1',
        bookingNumber: 'TB-2026-001',
        userId: mockUserId,
        startTime: '19:00',
        turf: { name: 'Super Turf' },
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.BOOKING_REMINDER,
          }),
        }),
      );
    });

    it('notifyRefundInitiated -> sends refund initiated notification', async () => {
      await service.notifyRefundInitiated({
        id: 'rfnd-1',
        userId: mockUserId,
        amount: 1400,
        refundNumber: 'RFND-12345',
        bookingId: 'b-1',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.REFUND_INITIATED,
          }),
        }),
      );
    });

    it('notifyRefundCompleted -> sends refund completed notification', async () => {
      await service.notifyRefundCompleted({
        id: 'rfnd-1',
        userId: mockUserId,
        amount: 1400,
        refundNumber: 'RFND-12345',
        bookingId: 'b-1',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.REFUND_COMPLETED,
          }),
        }),
      );
    });

    it('notifyOwnerBooking -> sends specialized owner booking alert', async () => {
      await service.notifyOwnerBooking(
        mockOwnerId,
        'Special Alert',
        'Owner custom update',
      );

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockOwnerId,
            type: NotificationType.OWNER_BOOKING_NOTIFICATION,
          }),
        }),
      );
    });
  });
});
