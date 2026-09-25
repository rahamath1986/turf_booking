import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class BlockSlotDto {
  @ApiProperty({
    description: 'Calendar date for slot block in YYYY-MM-DD format',
    example: '2026-09-26',
  })
  @IsNotEmpty()
  @IsDateString()
  blockDate: string;

  @ApiProperty({
    description: 'Start time of the block in HH:mm 24-hr format',
    example: '14:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be a valid 24-hour time string in HH:mm format',
  })
  startTime: string;

  @ApiProperty({
    description: 'End time of the block in HH:mm 24-hr format',
    example: '16:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be a valid 24-hour time string in HH:mm format',
  })
  endTime: string;

  @ApiPropertyOptional({
    description:
      'Reason for blocking slot (e.g. Maintenance, Tournament, Owner Hold, Weather)',
    example: 'Maintenance',
  })
  @IsOptional()
  @IsString()
  reason?: string = 'Maintenance';
}
