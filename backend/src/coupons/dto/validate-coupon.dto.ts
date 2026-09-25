import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class ValidateCouponDto {
  @ApiProperty({
    description: 'Coupon code to test and validate',
    example: 'SUMMER50',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'Current cart / booking order amount in INR',
    example: 1200,
  })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({
    description: 'Turf venue ID where the slot is being booked',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  turfId?: string;

  @ApiPropertyOptional({
    description: 'Sport type selected for this booking',
    example: 'CRICKET',
  })
  @IsOptional()
  @IsString()
  sportType?: string;
}
