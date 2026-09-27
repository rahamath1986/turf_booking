import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class TurfQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by city ID (UUID)' })
  @IsOptional()
  @IsUUID()
  cityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by city slug or name (e.g. bengaluru)',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Filter by area ID (UUID)' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ description: 'Filter by sport ID (UUID)' })
  @IsOptional()
  @IsUUID()
  sportId?: string;

  @ApiPropertyOptional({
    description: 'Filter by sport slug or name (e.g. football)',
  })
  @IsOptional()
  @IsString()
  sport?: string;

  @ApiPropertyOptional({
    description:
      'Filter by amenity / facility IDs (array or comma-separated UUIDs)',
    type: [String],
    example: ['b1a13e2e-2f10-449e-b2d2-8f9f0909419b'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    const items = Array.isArray(value)
      ? value.flatMap((v) => (typeof v === 'string' ? v.split(',') : v))
      : typeof value === 'string'
        ? value.split(',')
        : [value];
    const cleaned = items
      .map((item) => (typeof item === 'string' ? item.trim() : item))
      .filter((item) => Boolean(item));
    return cleaned.length > 0 ? cleaned : undefined;
  })
  @IsArray()
  @IsUUID('all', { each: true })
  facilityIds?: string[];

  @ApiPropertyOptional({
    description:
      'Alias for facilityIds: filter by amenity IDs (array or comma-separated UUIDs)',
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    const items = Array.isArray(value)
      ? value.flatMap((v) => (typeof v === 'string' ? v.split(',') : v))
      : typeof value === 'string'
        ? value.split(',')
        : [value];
    const cleaned = items
      .map((item) => (typeof item === 'string' ? item.trim() : item))
      .filter((item) => Boolean(item));
    return cleaned.length > 0 ? cleaned : undefined;
  })
  @IsArray()
  @IsUUID('all', { each: true })
  amenities?: string[];

  @ApiPropertyOptional({ description: 'Minimum hourly price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum hourly price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Minimum rating (0.0 to 5.0)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Optional user GPS latitude for distance computation' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Optional user GPS longitude for distance computation' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}
