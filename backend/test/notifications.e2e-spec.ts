import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Role } from '../src/common/enums/role.enum';
import { NotificationsService } from '../src/notifications/notifications.service';
import { NotificationType } from '@prisma/client';

describe('Notifications & Device Management (e2e)', () => {
  let app: INestApplication;
  let notificationsService: NotificationsService;

  const timestamp = Date.now();
  let customer1Token: string;
  let customer1Id: string;
  let customer2Token: string;

  let device1Id: string;
  let notification1Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'health/db'],
    });
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    notificationsService = app.get<NotificationsService>(NotificationsService);

    // 1. Register Customer 1
    const cust1Res = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Player Peter',
        email: `peter_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.CUSTOMER,
      });

    customer1Token = cust1Res.body.data.accessToken;
    customer1Id = cust1Res.body.data.user.id;

    // 2. Register Customer 2 (for multi-tenant authorization testing)
    const cust2Res = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Player Quinn',
        email: `quinn_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.CUSTOMER,
      });

    customer2Token = cust2Res.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Device FCM Registration & Lifecycle (POST & DELETE /api/v1/devices)', () => {
    it('POST /api/v1/devices -> register new Android device FCM token', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/devices')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          deviceToken: `fcm_android_${timestamp}`,
          deviceType: 'ANDROID',
          deviceName: 'Samsung Galaxy S24',
          osVersion: 'Android 14',
          appVersion: '1.2.0',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.deviceToken).toBe(`fcm_android_${timestamp}`);
      expect(res.body.data.deviceType).toBe('ANDROID');
      expect(res.body.data.isActive).toBe(true);

      device1Id = res.body.data.id;
    });

    it('POST /api/v1/devices -> register second iOS device for same customer', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/devices')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          deviceToken: `fcm_ios_${timestamp}`,
          deviceType: 'IOS',
          deviceName: 'iPhone 15 Pro',
          osVersion: 'iOS 17.4',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.deviceType).toBe('IOS');
    });

    it('POST /api/v1/devices -> re-registering existing token updates it idempotently', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/devices')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          deviceToken: `fcm_android_${timestamp}`,
          deviceType: 'ANDROID',
          deviceName: 'Samsung Galaxy S24 (Renamed)',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(device1Id);
      expect(res.body.data.deviceName).toBe('Samsung Galaxy S24 (Renamed)');
    });

    it('DELETE /api/v1/devices/:id -> reject unregister from another customer with 403 Forbidden', async () => {
      const res = await request
        .default(app.getHttpServer())
        .delete(`/api/v1/devices/${device1Id}`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .expect(403);

      expect(res.body.statusCode).toBe(403);
    });

    it('DELETE /api/v1/devices/:id -> customer unregisters their own device token', async () => {
      const res = await request
        .default(app.getHttpServer())
        .delete(`/api/v1/devices/${device1Id}`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Device unregistered successfully');
    });

    it('DELETE /api/v1/devices/:id -> return 404 for already deleted or non-existent device', async () => {
      const res = await request
        .default(app.getHttpServer())
        .delete(`/api/v1/devices/${device1Id}`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(404);

      expect(res.body.statusCode).toBe(404);
    });
  });

  describe('Notifications Inbox & Read Management (GET & POST /api/v1/notifications)', () => {
    beforeAll(async () => {
      // Dispatch 3 distinct test notifications to Customer 1
      const notif1 = await notificationsService.sendNotification(
        customer1Id,
        NotificationType.BOOKING_CONFIRMED,
        'Booking Confirmed! 🏟️',
        'Your booking for Starlight Turf is confirmed.',
        { bookingId: 'b-test-1' },
      );
      notification1Id = notif1.id;

      await notificationsService.sendNotification(
        customer1Id,
        NotificationType.PAYMENT_SUCCESSFUL,
        'Payment Successful 💳',
        'Payment of ₹1400 was received.',
        { paymentId: 'p-test-1' },
      );

      await notificationsService.sendNotification(
        customer1Id,
        NotificationType.BOOKING_REMINDER,
        'Match Reminder ⏰',
        'Your match starts in 2 hours!',
        { bookingId: 'b-test-1' },
      );
    });

    it('GET /api/v1/notifications -> retrieve paginated list and unread count', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.total).toBeGreaterThanOrEqual(3);
      expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(3);
      expect(res.body.data.page).toBe(1);
    });

    it('GET /api/v1/notifications?type=BOOKING_CONFIRMED -> filter by notification type', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/notifications?type=BOOKING_CONFIRMED')
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      for (const item of res.body.data.items) {
        expect(item.type).toBe('BOOKING_CONFIRMED');
      }
    });

    it('GET /api/v1/notifications/unread -> retrieve unread notifications and badge count', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/notifications/unread')
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(3);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(3);
    });

    it('POST /api/v1/notifications/:id/read -> reject attempt by unauthorized user (403)', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post(`/api/v1/notifications/${notification1Id}/read`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .expect(403);

      expect(res.body.statusCode).toBe(403);
    });

    it('POST /api/v1/notifications/:id/read -> mark specific notification as read', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post(`/api/v1/notifications/${notification1Id}/read`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(notification1Id);
      expect(res.body.data.isRead).toBe(true);
      expect(res.body.data.readAt).not.toBeNull();
    });

    it('POST /api/v1/notifications/read-all -> mark all unread notifications as read', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.markedReadCount).toBeGreaterThanOrEqual(2);

      // Verify unread badge count is now 0
      const unreadRes = await request
        .default(app.getHttpServer())
        .get('/api/v1/notifications/unread')
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(200);

      expect(unreadRes.body.data.unreadCount).toBe(0);
      expect(unreadRes.body.data.items.length).toBe(0);
    });
  });
});
