import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckInNotesDto {
  @ApiPropertyOptional({
    description:
      'Optional check-in or gate remarks (e.g. ID verified, locker assigned, equipment rented)',
    example: 'ID verified, locker #14 assigned',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    example: 12.9716,
    description: 'Current GPS latitude coordinate of user at check-in/out',
  })
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({
    example: 77.5946,
    description: 'Current GPS longitude coordinate of user at check-in/out',
  })
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({
    example: 'Koramangala, Bengaluru',
    description: 'Human-readable location or gate name at check-in/out',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    example: 15.5,
    description: 'GPS accuracy radius in meters',
  })
  @IsOptional()
  accuracy?: number;
}

export { CheckInNotesDto as CheckInDto };
