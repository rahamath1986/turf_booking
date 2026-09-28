import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { BookingStatus } from '@prisma/client';
import { BookingTimeSlotDto } from './booking-time-slot.dto';

export class UpdateBookingDto {
  @ApiPropertyOptional({
    description: 'Updated booking date in YYYY-MM-DD format',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString()
  bookingDate?: string;

  @ApiPropertyOptional({
    description: 'Updated start time in HH:mm 24-hr format',
    example: '18:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Updated end time in HH:mm 24-hr format',
    example: '20:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Updated array of time slots for multi-slot booking',
    type: [BookingTimeSlotDto],
    example: [
      { startTime: '18:00', endTime: '20:00' },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingTimeSlotDto)
  timeSlots?: BookingTimeSlotDto[];

  @ApiPropertyOptional({
    description: 'Updated sport ID for the booking',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4')
  sportId?: string;

  @ApiPropertyOptional({
    description: 'Updated booking status (Admin / Turf Owner only)',
    enum: BookingStatus,
    example: BookingStatus.CONFIRMED,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({
    description: 'Reason for updating or adjusting the booking',
    example: 'Customer requested slot shift or sport change',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
