import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class CustomFeeItemDto {
  @ApiPropertyOptional({
    description: 'Fee item name (e.g. equipment rental, coaching fee)',
    example: 'Locker & Bib Rental',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Fee item amount in INR',
    example: 100,
  })
  @IsNumber()
  @Min(0)
  amount: number;
}

export class CalculateQuoteDto {
  @ApiPropertyOptional({
    description: 'Active SlotHold UUID if the slot is already held',
    example: '22222222-2222-2222-2222-222222222222',
  })
  @IsOptional()
  @IsUUID('4')
  holdId?: string;

  @ApiPropertyOptional({
    description: 'Turf venue UUID (required if holdId not provided)',
    example: '11111111-1111-1111-1111-111111111111',
  })
  @IsOptional()
  @IsUUID('4')
  turfId?: string;

  @ApiPropertyOptional({
    description: 'Booking date in YYYY-MM-DD format (required if holdId not provided)',
    example: '2026-10-06',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Alias for date in YYYY-MM-DD format',
    example: '2026-10-06',
  })
  @IsOptional()
  @IsDateString()
  bookingDate?: string;

  @ApiPropertyOptional({
    description: 'Start time in HH:mm 24-hr format (required if holdId not provided)',
    example: '18:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string;

  @ApiPropertyOptional({
    description: 'End time in HH:mm 24-hr format (required if holdId not provided)',
    example: '19:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Sport UUID for sport-specific pricing',
    example: '33333333-3333-3333-3333-333333333333',
  })
  @IsOptional()
  @IsUUID('4')
  sportId?: string;

  @ApiPropertyOptional({
    description: 'Optional coupon code for discount calculation',
    example: 'PLAY100',
  })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({
    description: 'Optional custom fee items (e.g. equipment rental, coaching)',
    type: [CustomFeeItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFeeItemDto)
  customFeeItems?: CustomFeeItemDto[];
}
