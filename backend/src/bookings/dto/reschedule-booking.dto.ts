import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { BookingTimeSlotDto } from './booking-time-slot.dto';

export class RescheduleBookingDto {
  @ApiProperty({
    description: 'New target date in YYYY-MM-DD format',
    example: '2026-09-30',
  })
  @IsNotEmpty()
  @IsDateString()
  newDate: string;

  @ApiPropertyOptional({
    description: 'New start time in HH:mm 24-hr format (optional if newTimeSlots provided)',
    example: '19:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'newStartTime must be in HH:mm format',
  })
  newStartTime?: string;

  @ApiPropertyOptional({
    description: 'New end time in HH:mm 24-hr format (optional if newTimeSlots provided)',
    example: '20:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'newEndTime must be in HH:mm format',
  })
  newEndTime?: string;

  @ApiPropertyOptional({
    description: 'Array of new time slots for multi-slot booking rescheduling',
    type: [BookingTimeSlotDto],
    example: [
      { startTime: '19:00', endTime: '20:00', price: 1000 },
      { startTime: '20:00', endTime: '21:00', price: 1000 },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingTimeSlotDto)
  newTimeSlots?: BookingTimeSlotDto[];
}
