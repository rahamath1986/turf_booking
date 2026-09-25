import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
}
