import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class OwnerCancelBookingDto {
  @ApiProperty({
    description:
      'Reason for owner cancellation (e.g., severe weather, ground maintenance, double booking)',
    example: 'Ground maintenance required due to heavy rains',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
