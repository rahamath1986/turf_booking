import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class OperatingHourInputDto {
  @ApiProperty({
    example: 1,
    description: 'Day of week: 0 = Sun, 1 = Mon, ..., 6 = Sat',
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '06:00', description: 'Open time (HH:MM)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'openTime must be HH:MM format',
  })
  openTime: string;

  @ApiProperty({ example: '23:00', description: 'Close time (HH:MM)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'closeTime must be HH:MM format',
  })
  closeTime: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Whether turf is closed on this day',
  })
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}

export class PricingRuleInputDto {
  @ApiPropertyOptional({
    description: 'Sport ID (optional, defaults to all sports)',
  })
  @IsOptional()
  @IsUUID()
  sportId?: string;

  @ApiProperty({
    example: 'Weekend Evening Prime',
    description: 'Label for the pricing rule',
  })
  @IsString()
  @IsNotEmpty()
  ruleName: string;

  @ApiPropertyOptional({
    example: 'WEEKEND',
    default: 'ALL',
    description: 'ALL, WEEKDAY, WEEKEND, SPECIFIC_DAY',
  })
  @IsOptional()
  @IsString()
  dayType?: string;

  @ApiPropertyOptional({
    example: 6,
    description: 'Day of week if SPECIFIC_DAY',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiProperty({ example: '18:00', description: 'Start time (HH:MM)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime: string;

  @ApiProperty({ example: '23:00', description: 'End time (HH:MM)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime: string;

  @ApiProperty({
    example: 1500.0,
    description: 'Hourly price in currency units',
  })
  @IsNumber()
  @Min(0)
  hourlyPrice: number;
}

export class TurfImageInputDto {
  @ApiProperty({
    example: 'https://images.unsplash.com/...',
    description: 'Public image URL',
  })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @ApiPropertyOptional({ example: 'Night floodlights view' })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCover?: boolean;
}

export class CreateTurfDto {
  @ApiProperty({
    example: 'Champions Arena Koramangala',
    description: 'Turf venue display name',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'City UUID' })
  @IsUUID()
  cityId: string;

  @ApiPropertyOptional({ description: 'Area UUID within city' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({
    example: 'State of the art 7v7 football and badminton turf.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '100 Feet Road, 4th Block, Koramangala' })
  @IsString()
  @IsNotEmpty()
  addressLine: string;

  @ApiPropertyOptional({ example: '560034' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 12.9352 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 77.6245 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'contact@championsarena.in' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/...' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({
    example:
      '1. Studs allowed only on Football. 2. Non-marking shoes for badminton.',
  })
  @IsOptional()
  @IsString()
  rules?: string;

  @ApiPropertyOptional({
    example: 'Full refund if cancelled 4 hours prior to game time.',
  })
  @IsOptional()
  @IsString()
  cancellationPolicy?: string;

  @ApiPropertyOptional({
    description: 'Array of sport UUIDs hosted at this venue',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  sportIds?: string[];

  @ApiPropertyOptional({
    description: 'Array of facility UUIDs available at this venue',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  facilityIds?: string[];

  @ApiPropertyOptional({ type: [OperatingHourInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperatingHourInputDto)
  operatingHours?: OperatingHourInputDto[];

  @ApiPropertyOptional({ type: [PricingRuleInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingRuleInputDto)
  pricingRules?: PricingRuleInputDto[];

  @ApiPropertyOptional({ type: [TurfImageInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TurfImageInputDto)
  images?: TurfImageInputDto[];
}
