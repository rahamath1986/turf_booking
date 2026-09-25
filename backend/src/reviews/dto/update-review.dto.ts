import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateReviewDto {
  @ApiPropertyOptional({
    description: 'Rating score from 1 to 5',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    description: 'Updated review feedback',
    maxLength: 1000,
    example: 'Updated feedback: pitch condition was good overall.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
