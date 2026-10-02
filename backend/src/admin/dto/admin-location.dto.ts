import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class IsActiveField {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

// ---------------------------------------------------------------- Country ---

export class AdminCreateCountryDto extends IsActiveField {
  @ApiProperty({ example: 'India' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'IN' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  code: string;

  @ApiProperty({ example: '+91' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  phoneCode: string;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;
}

export class AdminUpdateCountryDto extends IsActiveField {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  phoneCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;
}

// ----------------------------------------------------------------- State ---

export class AdminCreateStateDto extends IsActiveField {
  @ApiProperty({ description: 'Parent country UUID' })
  @IsUUID()
  @IsNotEmpty()
  countryId: string;

  @ApiProperty({ example: 'Karnataka' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'KA' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;
}

export class AdminUpdateStateDto extends IsActiveField {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  countryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code?: string;
}

// ------------------------------------------------------------------ City ---

export class AdminCreateCityDto extends IsActiveField {
  @ApiProperty({ description: 'Parent state UUID' })
  @IsUUID()
  @IsNotEmpty()
  stateId: string;

  @ApiProperty({ example: 'Bengaluru' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'bengaluru',
    description: 'Auto-generated from name when omitted',
  })
  @IsOptional()
  @IsString()
  @Matches(SLUG_REGEX, {
    message: 'slug must be lowercase alphanumeric with dashes',
  })
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

export class AdminUpdateCityDto extends IsActiveField {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  stateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(SLUG_REGEX, {
    message: 'slug must be lowercase alphanumeric with dashes',
  })
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number | null;
}

// ------------------------------------------------------------------ Area ---

export class AdminCreateAreaDto extends IsActiveField {
  @ApiProperty({ description: 'Parent city UUID' })
  @IsUUID()
  @IsNotEmpty()
  cityId: string;

  @ApiProperty({ example: 'Koramangala' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    description: 'Auto-generated from name when omitted (unique per city)',
  })
  @IsOptional()
  @IsString()
  @Matches(SLUG_REGEX, {
    message: 'slug must be lowercase alphanumeric with dashes',
  })
  @MaxLength(170)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

export class AdminUpdateAreaDto extends IsActiveField {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(SLUG_REGEX, {
    message: 'slug must be lowercase alphanumeric with dashes',
  })
  @MaxLength(170)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number | null;
}
