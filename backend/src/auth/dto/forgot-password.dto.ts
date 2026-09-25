import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'rahul.sharma@example.com',
    description: 'Registered account email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
