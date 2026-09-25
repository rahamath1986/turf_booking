import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { API_CONSTANTS } from '../constants';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = API_CONSTANTS.DEFAULT_PAGE;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'Items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(API_CONSTANTS.MAX_LIMIT)
  limit: number = API_CONSTANTS.DEFAULT_LIMIT;

  @ApiPropertyOptional({ description: 'Field name to sort by' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    enum: SortOrder,
    default: SortOrder.DESC,
    description: 'Sort direction',
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({ description: 'Search term for queries' })
  @IsOptional()
  @IsString()
  search?: string;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export class PaginatedResultMeta {
  @ApiPropertyOptional()
  page: number;

  @ApiPropertyOptional()
  limit: number;

  @ApiPropertyOptional()
  totalItems: number;

  @ApiPropertyOptional()
  totalPages: number;

  @ApiPropertyOptional()
  hasNextPage: boolean;

  @ApiPropertyOptional()
  hasPreviousPage: boolean;
}

export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginatedResultMeta;

  constructor(items: T[], totalItems: number, page: number, limit: number) {
    const totalPages = Math.ceil(totalItems / limit) || 1;
    this.data = items;
    this.meta = {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
