import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum PaymentMethodType {
  ONLINE = 'ONLINE',
  CASH = 'CASH',
  UPI = 'UPI',
  CARD = 'CARD',
}

export class CompleteBookingPaymentDto {
  @ApiPropertyOptional({
    description: 'Payment method used to complete remaining balance',
    enum: PaymentMethodType,
    default: PaymentMethodType.ONLINE,
    example: PaymentMethodType.ONLINE,
  })
  @IsOptional()
  @IsEnum(PaymentMethodType)
  paymentMethod?: PaymentMethodType = PaymentMethodType.ONLINE;

  @ApiPropertyOptional({
    description:
      'Payment amount to settle (optional; defaults to the entire remaining balance amount)',
    example: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({
    description:
      'External transaction or reference ID (e.g. UPI UTR number, pos slip number, or cash receipt number)',
    example: 'UPI-9876543210',
  })
  @IsOptional()
  @IsString()
  transactionReference?: string;

  @ApiPropertyOptional({
    description: 'Optional staff or customer notes regarding settlement',
    example: 'Customer paid remaining balance in cash at venue gate',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Client-side idempotency key to prevent double recording',
    example: 'comp_idem_9f823a-bc34-99',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
