import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateRefundDto {
  @ApiProperty({
    description: 'Unique identifier of the booking to be refunded',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;

  @ApiPropertyOptional({
    description:
      'Optional manual refund amount (Admin override). If omitted, calculated server-side.',
    example: 1050,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Reason for the refund',
    example: 'Turf maintenance or weather disruption',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
