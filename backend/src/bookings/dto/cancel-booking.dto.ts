import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelBookingDto {
  @ApiPropertyOptional({
    description: 'Reason for cancellation',
    example: 'Rain forecasted or schedule clash',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
