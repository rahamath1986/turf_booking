import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class CreateWalkInBookingDto {
  @ApiProperty({
    description: 'Turf venue ID where slot is being booked',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  turfId: string;

  @ApiPropertyOptional({
    description: 'Sport ID being played',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  sportId?: string;

  @ApiProperty({
    description: 'Booking match date (YYYY-MM-DD)',
    example: '2026-09-28',
  })
  @IsDateString()
  @IsNotEmpty()
  bookingDate: string;

  @ApiProperty({
    description: 'Slot start time in 24h format (HH:mm)',
    example: '18:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Start time must be in HH:mm format (e.g. 18:00)',
  })
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({
    description: 'Slot end time in 24h format (HH:mm)',
    example: '19:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'End time must be in HH:mm format (e.g. 19:00)',
  })
  @IsNotEmpty()
  endTime: string;

  @ApiProperty({
    description: 'Walk-in customer full name',
    example: 'Johnathan Walkin',
  })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({
    description: 'Walk-in customer phone number',
    example: '+919876543210',
  })
  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @ApiPropertyOptional({
    description: 'Walk-in customer email address',
    example: 'walkin@example.com',
  })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional({
    description:
      'Total booking price charged in INR (defaults to calculated turf slot price if omitted)',
    example: 1200,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @ApiPropertyOptional({
    description: 'Offline payment method collected at venue',
    default: 'CASH',
    example: 'CASH',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string = 'CASH';

  @ApiPropertyOptional({
    description: 'Staff notes or instructions for this booking',
    example: 'Booked directly at reception counter',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
