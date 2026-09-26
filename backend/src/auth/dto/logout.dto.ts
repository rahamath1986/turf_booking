import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'Refresh token to revoke (optional if revoking current session via Bearer token)',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({
    example: 'dK_fcm_token_sample_12345...',
    description:
      'FCM device push token to deactivate upon logout',
  })
  @IsOptional()
  @IsString()
  fcmToken?: string;

  @ApiPropertyOptional({
    example: 12.9716,
    description: 'Current GPS latitude coordinate of user on logout',
  })
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({
    example: 77.5946,
    description: 'Current GPS longitude coordinate of user on logout',
  })
  @IsOptional()
  longitude?: number;
}
