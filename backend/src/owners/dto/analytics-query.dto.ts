import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter analytics to a specific turf venue ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  turfId?: string;

  @ApiPropertyOptional({
    description: 'Start date for analytics filter (YYYY-MM-DD)',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for analytics filter (YYYY-MM-DD)',
    example: '2026-09-30',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
