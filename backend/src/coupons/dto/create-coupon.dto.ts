import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT',
}

export class CreateCouponDto {
  @ApiProperty({
    description: 'Unique uppercase promo code',
    example: 'SUMMER50',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({
    description: 'Coupon description/terms',
    example: '50% off up to ₹200 on first booking',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DiscountType, default: DiscountType.PERCENTAGE })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty({ description: 'Percentage or flat amount value', example: 50 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  discountValue: number;

  @ApiPropertyOptional({
    description: 'Minimum order amount in INR',
    default: 0,
    example: 500,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minOrderAmount?: number = 0;

  @ApiPropertyOptional({
    description: 'Maximum discount cap for percentage discounts in INR',
    example: 200,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({
    description: 'Start date/time when coupon becomes active',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'Expiration date/time for the coupon' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Total global redemptions allowed across platform',
    example: 500,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  totalUsageLimit?: number;

  @ApiPropertyOptional({
    description: 'Maximum redemptions per user',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  perUserLimit?: number = 1;

  @ApiPropertyOptional({
    description:
      'Specific turf venue IDs eligible for this coupon. Empty means all turfs.',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  turfIds?: string[];

  @ApiPropertyOptional({
    description:
      'Specific turf-owner profile IDs eligible for this coupon. Empty means all owners (global).',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  ownerIds?: string[];

  @ApiPropertyOptional({
    description:
      'Days of week (0=Sunday..6=Saturday) this coupon is valid on. Empty means all days. Use [0,6] for weekend offers.',
    example: [0, 6],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  validDays?: number[];

  @ApiPropertyOptional({
    description:
      'Specific sport types eligible for this coupon. Empty means all sports.',
    example: ['CRICKET', 'FOOTBALL'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sportTypes?: string[];

  @ApiPropertyOptional({
    description:
      'Whether the coupon is restricted to first-time booking users only',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isFirstBookingOnly?: boolean = false;

  @ApiPropertyOptional({
    description: 'Whether the coupon is enabled',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
