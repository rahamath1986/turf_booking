import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AvailableSlotsQueryDto {
  @ApiPropertyOptional({
    description:
      'Specific date to calculate slots for in YYYY-MM-DD format (defaults to current date)',
    example: '2026-09-26',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Optional sport ID for sport-specific pricing overrides',
    example: '11111111-1111-1111-1111-111111111111',
  })
  @IsOptional()
  @IsUUID('4')
  sportId?: string;
}
