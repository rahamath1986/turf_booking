import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ScanQrDto {
  @ApiProperty({
    description:
      'Cryptographically signed QR token scanned from customer device',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  qrToken: string;

  @ApiPropertyOptional({
    description:
      'Turf venue ID where scan is occurring (for staff gate validation)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  turfId?: string;
}
