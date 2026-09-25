import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetOwnerCommissionDto {
  @ApiProperty({ example: 10.0, description: 'Commission percentage (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate: number;

  @ApiPropertyOptional({ example: 'Negotiated rate for premium partner' })
  @IsOptional()
  @IsString()
  notes?: string;
}
