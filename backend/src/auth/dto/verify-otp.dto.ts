import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { OtpPurpose } from './send-otp.dto';

export class VerifyOtpDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'Target phone number or email',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit numeric OTP code',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit number' })
  otp: string;

  @ApiProperty({
    enum: OtpPurpose,
    example: OtpPurpose.LOGIN,
    description: 'Operational intent of the OTP',
  })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
