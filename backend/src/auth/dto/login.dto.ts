import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'rahul.sharma@example.com',
    description: 'Registered email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'Password#123',
    description: 'User account password',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    example: 'dK_fcm_token_sample_12345...',
    description:
      'Firebase Cloud Messaging (FCM) device token for push notifications',
  })
  @IsOptional()
  @IsString()
  firebaseToken?: string;

  @ApiPropertyOptional({
    example: 'dK_fcm_token_sample_12345...',
    description: 'Alternative alias for firebaseToken (FCM Token)',
  })
  @IsOptional()
  @IsString()
  fcmToken?: string;

  @ApiPropertyOptional({
    example: 'ANDROID',
    description: 'Device platform type (e.g. ANDROID, IOS, WEB)',
  })
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional({
    example: 'Samsung S24 / Chrome on Mac',
    description: 'Device name or model descriptor',
  })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional({
    example: 12.9716,
    description: 'Current GPS latitude coordinate of user on login',
  })
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({
    example: 77.5946,
    description: 'Current GPS longitude coordinate of user on login',
  })
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({
    example: 'Koramangala, Bengaluru',
    description: 'Human-readable location or city descriptor on login',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    example: 15.5,
    description: 'GPS accuracy radius in meters',
  })
  @IsOptional()
  accuracy?: number;
}
