import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class AdminCreateSportDto {
  @ApiProperty({ example: 'Football' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'football',
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
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/icons/football.png' })
  @IsOptional()
  @IsUrl({}, { message: 'iconUrl must be a valid URL' })
  @MaxLength(500)
  iconUrl?: string;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? value : parseInt(value, 10),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  minPlayers?: number;

  @ApiPropertyOptional({ default: 22 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? value : parseInt(value, 10),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  maxPlayers?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class AdminUpdateSportDto {
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
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  iconUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? value : parseInt(value, 10),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  minPlayers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? value : parseInt(value, 10),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  maxPlayers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class AdminCreateFacilityDto {
  @ApiProperty({ example: 'Floodlights' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'floodlights',
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
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/icons/floodlights.png' })
  @IsOptional()
  @IsUrl({}, { message: 'iconUrl must be a valid URL' })
  @MaxLength(500)
  iconUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class AdminUpdateFacilityDto {
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
  @IsString()
  @MaxLength(255)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  iconUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
