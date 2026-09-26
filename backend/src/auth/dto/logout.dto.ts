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
      'Firebase device push token to deactivate upon logout',
  })
  @IsOptional()
  @IsString()
  firebaseToken?: string;

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

  @ApiPropertyOptional({
    example: 'Koramangala, Bengaluru',
    description: 'Human-readable location or city descriptor on logout',
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
