import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckInNotesDto {
  @ApiPropertyOptional({
    description:
      'Optional check-in or gate remarks (e.g. ID verified, locker assigned, equipment rented)',
    example: 'ID verified, locker #14 assigned',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
