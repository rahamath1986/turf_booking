import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateHoldDto {
  @ApiProperty({
    description: 'UUID of the turf venue to hold',
    example: '11111111-1111-1111-1111-111111111111',
  })
  @IsNotEmpty()
  @IsUUID('4')
  turfId: string;

  @ApiProperty({
    description: 'Target booking date in YYYY-MM-DD format',
    example: '2026-09-28',
  })
  @IsNotEmpty()
  @IsDateString()
  holdDate: string;

  @ApiProperty({
    description: 'Slot start time in HH:mm 24-hr format',
    example: '18:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @ApiProperty({
    description: 'Slot end time in HH:mm 24-hr format',
    example: '19:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Optional sport ID for sport-specific court reservation',
  })
  @IsOptional()
  @IsUUID('4')
  sportId?: string;

  @ApiPropertyOptional({
    description:
      'Unique client-side idempotency key to prevent duplicate holds on retries',
    example: 'hold_idem_9f823a-bc34-11',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
