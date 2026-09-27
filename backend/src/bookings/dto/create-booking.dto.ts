import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CustomFeeItemDto } from './calculate-quote.dto';

export class CreateBookingDto {
  @ApiPropertyOptional({
    description:
      'Existing active SlotHold UUID (recommended workflow: Hold -> Payment -> Confirm)',
    example: '22222222-2222-2222-2222-222222222222',
  })
  @IsOptional()
  @IsUUID('4')
  holdId?: string;

  @ApiPropertyOptional({
    description: 'Turf UUID (required if holdId not provided)',
  })
  @IsOptional()
  @IsUUID('4')
  turfId?: string;

  @ApiPropertyOptional({
    description:
      'Booking date in YYYY-MM-DD format (required if holdId not provided)',
    example: '2026-09-28',
  })
  @IsOptional()
  @IsDateString()
  bookingDate?: string;

  @ApiPropertyOptional({
    description:
      'Start time in HH:mm 24-hr format (required if holdId not provided)',
    example: '18:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string;

  @ApiPropertyOptional({
    description:
      'End time in HH:mm 24-hr format (required if holdId not provided)',
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
  })
  @IsOptional()
  @IsUUID('4')
  sportId?: string;

  @ApiPropertyOptional({
    description:
      'Unique client-side idempotency key to prevent double charging/booking on network retries',
    example: 'book_idem_9f823a-bc34-22',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description: 'Optional coupon code for booking discount',
    example: 'PLAY100',
  })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({
    description: 'Optional custom fee items (e.g. equipment rental, coaching fee)',
    type: [CustomFeeItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFeeItemDto)
  customFeeItems?: CustomFeeItemDto[];
}
