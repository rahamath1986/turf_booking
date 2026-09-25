import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReplyReviewDto {
  @ApiProperty({
    description: "Turf owner's public reply to customer review",
    example:
      'Thank you for your feedback! We look forward to hosting your team again.',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reply: string;
}
