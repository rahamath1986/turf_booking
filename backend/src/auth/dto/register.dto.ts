import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class RegisterDto {
  @ApiProperty({
    example: 'Rahul Sharma',
    description: 'Full name of the user',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  fullName: string;

  @ApiProperty({
    example: 'rahul.sharma@example.com',
    description: 'Unique email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    example: '+919876543210',
    description: 'Mobile phone number with country code',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message:
      'Phone number must be a valid E.164 phone format (e.g. +919876543210)',
  })
  phone?: string;

  @ApiProperty({
    example: 'Password#123',
    description: 'Strong password with min 8 characters',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiPropertyOptional({
    enum: [Role.CUSTOMER, Role.TURF_OWNER],
    default: Role.CUSTOMER,
    description: 'Initial role on registration (default: CUSTOMER)',
  })
  @IsOptional()
  @IsEnum([Role.CUSTOMER, Role.TURF_OWNER], {
    message: 'Registration role must be either CUSTOMER or TURF_OWNER',
  })
  role?: Role = Role.CUSTOMER;

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
}
