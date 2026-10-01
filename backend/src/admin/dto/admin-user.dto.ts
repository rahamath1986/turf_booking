import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayNotEmpty,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Role } from '../../common/enums/role.enum';

// Phone validation shared with auth RegisterDto (E.164).
const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

export class AdminCreateUserDto {
  @ApiProperty({ example: 'Rahul Sharma' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ example: 'rahul.sharma@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'Password#123',
    description: 'Initial password (min 8 characters)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, {
    message:
      'Phone number must be a valid E.164 phone format (e.g. +919876543210)',
  })
  phone?: string;

  @ApiPropertyOptional({
    enum: Role,
    isArray: true,
    default: [Role.CUSTOMER],
    description: 'Roles to assign (default: CUSTOMER)',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(Role, { each: true, message: 'Each role must be a valid role name' })
  roles?: Role[];

  @ApiPropertyOptional({
    default: true,
    description: 'Activate the account immediately (default: true)',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
