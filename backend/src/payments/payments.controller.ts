import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  @ApiOperation({
    summary: 'Create payment order with configurable payment gateway provider',
    description:
      'Initiates an order with the active payment provider (Razorpay, Stripe, or Mock) for a slot hold or booking.',
  })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Missing holdId or amount' })
  @ApiResponse({ status: 410, description: 'Slot hold has expired' })
  createOrder(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.paymentsService.createOrder(userId, dto);
  }

  @Post('booking/:id/complete-payment')
  @ApiOperation({
    summary: 'Create payment order to complete balance on an advance booking',
    description:
      'Initiates an order for remaining balance on an advance booking with the active payment provider.',
  })
  @ApiResponse({ status: 201, description: 'Order created successfully for remaining balance' })
  @ApiResponse({ status: 400, description: 'Booking already fully paid' })
  completeBookingPayment(
    @CurrentUser('userId') userId: string,
    @Param('id') bookingId: string,
    @Body() dto: Partial<CreateOrderDto>,
  ) {
    return this.paymentsService.createOrder(userId, {
      ...dto,
      bookingId,
    });
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Server-side cryptographic payment verification',
    description:
      'Verifies HMAC signature server-side. A booking is NEVER confirmed solely from a Flutter callback without valid signature.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verified and booking confirmed',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid signature or tampering detected',
  })
  @ApiResponse({ status: 404, description: 'Payment record not found' })
  verifyPayment(
    @CurrentUser('userId') userId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(userId, dto);
  }

  @Get(':id/status')
  @ApiOperation({
    summary: 'Lightweight payment status inquiry',
    description: 'Returns real-time status of payment for client polling.',
  })
  @ApiResponse({ status: 200, description: 'Payment status' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  getStatus(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.paymentsService.getPaymentStatus(userId, userRoles, id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Retrieve detailed payment record and status transition history',
    description:
      'Returns complete payment audit trail including gateway order ID, transaction ID, and state changes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment details and audit history',
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  findOne(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.paymentsService.getPaymentById(userId, userRoles, id);
  }
}
