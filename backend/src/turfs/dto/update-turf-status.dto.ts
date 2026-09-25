import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateTurfStatusDto {
  @ApiProperty({
    example: true,
    description: 'Operational active status of the turf venue',
  })
  @IsBoolean()
  isActive: boolean;
}
