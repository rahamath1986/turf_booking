import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
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
import { Type } from 'class-transformer';

export class OperatingHourInputDto {
  @ApiProperty({
    description: 'Day of week: 0 (Sunday) to 6 (Saturday)',
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({
    description: 'Opening time in HH:mm 24-hr format',
    example: '06:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'openTime must be a valid 24-hour time string in HH:mm format',
  })
  openTime: string;

  @ApiProperty({
    description:
      'Closing time in HH:mm 24-hr format (use 23:59 or 00:00 for midnight)',
    example: '23:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'closeTime must be a valid 24-hour time string in HH:mm format',
  })
  closeTime: string;

  @ApiPropertyOptional({
    description:
      'Flag indicating whether venue is closed entirely on this day of week',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean = false;

  @ApiPropertyOptional({
    description: 'Slot duration in minutes (e.g. 120 for 2-hour slots)',
    default: 120,
    example: 120,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(720)
  slotDurationMinutes?: number = 120;
}

export class PricingRuleInputDto {
  @ApiProperty({
    description:
      'Descriptive name for rule (e.g. "Weekday Standard", "Peak Evening Rate")',
    example: 'Peak Evening Rate',
  })
  @IsString()
  @IsNotEmpty()
  ruleName: string;

  @ApiProperty({
    description:
      'Day category: ALL, WEEKDAY, WEEKEND, PEAK, OFF_PEAK, HOLIDAY, SPECIAL',
    example: 'PEAK',
  })
  @IsString()
  @IsNotEmpty()
  dayType: string;

  @ApiPropertyOptional({
    description:
      'Specific day of week (0=Sunday to 6=Saturday) if constrained to a single day',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({
    description:
      'Specific calendar date (YYYY-MM-DD) for holiday or special event overrides',
    example: '2026-12-25',
  })
  @IsOptional()
  @IsString()
  specificDate?: string;

  @ApiProperty({
    description: 'Start of active pricing window in HH:mm format',
    example: '18:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @ApiProperty({
    description: 'End of active pricing window in HH:mm format',
    example: '22:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @ApiProperty({
    description: 'Hourly rate charged for matching slots (INR)',
    example: 1800,
  })
  @IsNumber()
  @Min(0)
  hourlyPrice: number;

  @ApiPropertyOptional({
    description:
      'Optional sport ID if this rule only applies to a specific sport',
  })
  @IsOptional()
  @IsUUID('4')
  sportId?: string;

  @ApiPropertyOptional({
    description: 'Active status of the pricing rule',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class SetAvailabilityDto {
  @ApiPropertyOptional({
    description: 'Turf-level default open time in HH:mm format',
    example: '06:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  openTime?: string;

  @ApiPropertyOptional({
    description: 'Turf-level default close time in HH:mm format',
    example: '22:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  closeTime?: string;

  @ApiPropertyOptional({
    description: 'Turf-level slot duration in minutes (e.g. 120 for 2-hour slots)',
    example: 120,
    default: 120,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(720)
  slotDurationMinutes?: number;

  @ApiProperty({
    description:
      'Weekly operating hours for the turf (0 = Sun, 1 = Mon ... 6 = Sat)',
    type: [OperatingHourInputDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperatingHourInputDto)
  operatingHours: OperatingHourInputDto[];

  @ApiPropertyOptional({
    description:
      'Optional pricing rules matrix configuring weekday, weekend, peak, holiday rates',
    type: [PricingRuleInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingRuleInputDto)
  pricingRules?: PricingRuleInputDto[];
}
