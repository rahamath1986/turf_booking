export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  appName: process.env.APP_NAME || 'app-turf-api',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),

  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ||
      'dev_super_secret_jwt_access_key_min_32_chars_2026_sports',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      'dev_super_secret_jwt_refresh_key_min_32_chars_2026_sports',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  // QR check-in tokens use a SEPARATE secret, never shared with JWT
  checkin: {
    qrSecret:
      process.env.CHECKIN_QR_SECRET ||
      (process.env.NODE_ENV === 'production'
        ? (() => {
            throw new Error(
              'CHECKIN_QR_SECRET must be set in production. Add it to your environment secrets.',
            );
          })()
        : 'dev-qr-secret-not-for-production-replace-me'),
  },

  database: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://turf_admin:turf_secure_password_dev@localhost:5432/turf_booking_db?schema=public',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    holdTtlSeconds: parseInt(
      process.env.REDIS_TTL_SLOT_HOLD_SECONDS || '600',
      10,
    ),
  },

  azure: {
    resourceGroup: process.env.AZURE_RESOURCE_GROUP || 'rg-sansamg-platform',
    subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
    blobConnectionString:
      process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING || '',
    blobContainerName:
      process.env.AZURE_BLOB_CONTAINER_NAME || 'turf-media-uploads',
  },

  payment: {
    provider: process.env.PAYMENT_GATEWAY_PROVIDER || 'mock',
    keyId: process.env.PAYMENT_GATEWAY_KEY_ID || 'test_key_mock_12345',
    keySecret:
      process.env.PAYMENT_GATEWAY_KEY_SECRET || 'test_secret_mock_67890',
    webhookSecret:
      process.env.PAYMENT_WEBHOOK_SECRET || 'test_webhook_secret_sports_2026',
  },

  throttler: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },
});
