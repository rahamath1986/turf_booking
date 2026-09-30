import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiPropertyOptional({
    description:
      'Existing active SlotHold UUID (recommended flow: Hold -> Payment -> Confirm)',
    example: '11111111-1111-1111-1111-111111111111',
  })
  @IsOptional()
  @IsUUID('4')
  holdId?: string;

  @ApiPropertyOptional({
    description:
      'Existing Booking UUID if paying for an unpaid/pending booking',
    example: '22222222-2222-2222-2222-222222222222',
  })
  @IsOptional()
  @IsUUID('4')
  bookingId?: string;

  @ApiPropertyOptional({
    description:
      'Payment amount in INR (if not provided, calculated from hold/booking)',
    example: 1500,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Currency code (defaults to INR)',
    example: 'INR',
  })
  @IsOptional()
  @IsString()
  currency?: string = 'INR';

  @ApiPropertyOptional({
    description:
      'Unique client-side idempotency key to prevent double charging on network retry',
    example: 'pay_idem_9f823a-bc34-33',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description: 'Whether this order is an advance / minimum payment order for a slot hold',
    example: true,
  })
  @IsOptional()
  isAdvance?: boolean;

  @ApiPropertyOptional({
    description:
      'Specific advance payment amount (must be >= minimum required advance payment for the turf)',
    example: 500,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  advanceAmount?: number;
}
