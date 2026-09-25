import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class OwnerRescheduleBookingDto {
  @ApiProperty({
    description: 'New booking date (YYYY-MM-DD)',
    example: '2026-09-30',
  })
  @IsDateString()
  @IsNotEmpty()
  newDate: string;

  @ApiProperty({
    description: 'New slot start time (HH:mm)',
    example: '19:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'New start time must be in HH:mm format (e.g. 19:00)',
  })
  @IsNotEmpty()
  newStartTime: string;

  @ApiPropertyOptional({
    description:
      'New slot end time (HH:mm). If omitted, retains existing duration.',
    example: '20:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'New end time must be in HH:mm format (e.g. 20:00)',
  })
  newEndTime?: string;

  @ApiPropertyOptional({
    description: 'Reason for rescheduling the match',
    example: 'Customer requested reschedule due to team delay',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
