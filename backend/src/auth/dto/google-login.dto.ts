import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({ example: 'user@gmail.com', description: 'Google verified email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: 'Vinoth Kannan', description: 'User display name' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'https://lh3.googleusercontent.com/...', description: 'Avatar photo URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'id_token_from_google', description: 'Google OAuth id token' })
  @IsOptional()
  @IsString()
  idToken?: string;

  @ApiPropertyOptional({ example: 12.9716, description: 'GPS Latitude' })
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 77.5946, description: 'GPS Longitude' })
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ example: 'Madurai, Tamil Nadu', description: 'Human readable location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'fcm_token_abc', description: 'FCM push notification token' })
  @IsOptional()
  @IsString()
  fcmToken?: string;
}
