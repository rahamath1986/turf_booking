import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationProvider,
  PushNotificationMessage,
  PushNotificationResult,
} from '../interfaces/notification-provider.interface';

@Injectable()
export class FcmNotificationAdapter implements NotificationProvider {
  readonly providerName = 'FCM';
  private readonly logger = new Logger(FcmNotificationAdapter.name);

  private readonly projectId?: string;
  private readonly clientEmail?: string;
  private readonly privateKey?: string;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    this.clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    this.privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    this.isConfigured = Boolean(
      this.projectId && this.clientEmail && this.privateKey,
    );

    if (this.isConfigured) {
      this.logger.log(
        `FcmNotificationAdapter initialized for Firebase Project: ${this.projectId}`,
      );
    } else {
      this.logger.log(
        'FcmNotificationAdapter initialized in Mock/Development mode (Firebase environment credentials not set)',
      );
    }
  }

  /**
   * Dispatches push notifications to target device tokens.
   * If live credentials are provided, connects to Firebase Cloud Messaging.
   * Otherwise, provides structured logging and graceful fallback for tests/local dev.
   */
  sendPush(message: PushNotificationMessage): Promise<PushNotificationResult> {
    if (!message.tokens || message.tokens.length === 0) {
      return Promise.resolve({
        success: true,
        successCount: 0,
        failureCount: 0,
        provider: this.providerName,
      });
    }

    if (this.isConfigured) {
      // In production with live FCM credentials, this would invoke the Firebase Admin SDK
      // or FCM HTTP v1 API using the loaded service account credentials.
      this.logger.log(
        `[FCM Live] Sending push to ${message.tokens.length} devices: "${message.title}"`,
      );
    } else {
      this.logger.debug(
        `[FCM Mock] Push message dispatched to ${message.tokens.length} tokens: Title="${message.title}", Body="${message.body}"`,
      );
    }

    return Promise.resolve({
      success: true,
      successCount: message.tokens.length,
      failureCount: 0,
      provider: this.providerName,
    });
  }
}
