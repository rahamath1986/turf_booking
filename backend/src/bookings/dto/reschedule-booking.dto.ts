import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, Matches } from 'class-validator';

export class RescheduleBookingDto {
  @ApiProperty({
    description: 'New target date in YYYY-MM-DD format',
    example: '2026-09-30',
  })
  @IsNotEmpty()
  @IsDateString()
  newDate: string;

  @ApiProperty({
    description: 'New start time in HH:mm 24-hr format',
    example: '19:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'newStartTime must be in HH:mm format',
  })
  newStartTime: string;

  @ApiProperty({
    description: 'New end time in HH:mm 24-hr format',
    example: '20:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'newEndTime must be in HH:mm format',
  })
  newEndTime: string;
}
