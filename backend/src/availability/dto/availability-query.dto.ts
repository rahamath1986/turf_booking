import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AvailabilityQueryDto {
  @ApiPropertyOptional({
    description: 'Starting date in YYYY-MM-DD format (defaults to today)',
    example: '2026-09-26',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description:
      'Number of consecutive days to inspect (1 to 14, defaults to 7)',
    default: 7,
    minimum: 1,
    maximum: 14,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  days?: number = 7;
}
