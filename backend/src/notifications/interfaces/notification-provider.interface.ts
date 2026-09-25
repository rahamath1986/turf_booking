export interface PushNotificationMessage {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface PushNotificationResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  provider: string;
  failedTokens?: string[];
}

export interface NotificationProvider {
  readonly providerName: string;
  sendPush(message: PushNotificationMessage): Promise<PushNotificationResult>;
}
