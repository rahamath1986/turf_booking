import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'd9b7a48c6f1e2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f',
    description: 'Password reset token received via email/OTP',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'NewSecurePassword#2026',
    description: 'New password with minimum 8 characters',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword: string;
}
