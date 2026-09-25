import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessSettlementDto {
  @ApiPropertyOptional({ example: 'Processed via bank transfer NEFT/RTGS' })
  @IsOptional()
  @IsString()
  notes?: string;
}
