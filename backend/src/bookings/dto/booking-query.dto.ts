import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { BookingStatus } from '@prisma/client';

export class BookingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter bookings by status',
    enum: BookingStatus,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({
    description: 'Filter bookings for a specific turf',
  })
  @IsOptional()
  @IsUUID('4')
  turfId?: string;

  @ApiPropertyOptional({
    description: 'Filter bookings on a specific date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}
