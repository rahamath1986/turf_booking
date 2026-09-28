import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class BookingTimeSlotDto {
  @ApiProperty({
    description: 'Slot start time in HH:mm 24-hr format',
    example: '18:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @ApiProperty({
    description: 'Slot end time in HH:mm 24-hr format',
    example: '19:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Slot price in INR (if pre-calculated)',
    example: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description: 'Duration of slot in minutes',
    example: 60,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationMinutes?: number;
}
