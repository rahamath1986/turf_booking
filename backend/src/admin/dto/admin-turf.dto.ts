import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CreateTurfDto } from '../../turfs/dto/create-turf.dto';

export class AdminCreateTurfDto extends CreateTurfDto {
  @ApiProperty({
    description: 'TurfOwner profile UUID the venue belongs to',
  })
  @IsUUID()
  @IsNotEmpty()
  ownerId: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Approve immediately (default: true for admin-created turfs)',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isApproved?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: 'Activate immediately (default: true)',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isFeatured?: boolean;
}

export class AdminUpdateTurfDto extends PartialType(AdminCreateTurfDto) {}

export class AdminAddTurfImageDto {
  @ApiProperty({ example: 'https://cdn.example.com/turfs/arena-1.jpg' })
  @IsUrl({}, { message: 'imageUrl must be a valid URL' })
  @IsNotEmpty()
  imageUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  caption?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Promote to cover image',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isCover?: boolean;
}

export class AdminCreateBookingDto {
  @ApiProperty({ description: 'Customer user UUID the booking is for' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Turf venue UUID' })
  @IsUUID()
  @IsNotEmpty()
  turfId: string;

  @ApiPropertyOptional({ description: 'Sport UUID for sport-specific pricing' })
  @IsOptional()
  @IsUUID()
  sportId?: string;

  @ApiProperty({
    example: '2026-10-05',
    description: 'Booking date in YYYY-MM-DD format',
  })
  @IsDateString()
  @IsNotEmpty()
  bookingDate: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @ApiProperty({ example: '19:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @ApiPropertyOptional({ description: 'Internal note stored on the booking' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
