import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum OtpPurpose {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PHONE_VERIFY = 'PHONE_VERIFY',
}

export class SendOtpDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'Target phone number or email for OTP dispatch',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({
    enum: OtpPurpose,
    example: OtpPurpose.LOGIN,
    description: 'Operational intent of the OTP',
  })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
