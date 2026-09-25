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
import { RefundsService } from './refunds.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateRefundDto } from './dto/create-refund.dto';

@ApiTags('Refunds')
@Controller('refunds')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Issue a refund for a booking',
    description:
      'Initiates a refund via the payment provider adapter, updates payment and booking status to REFUNDED/PARTIALLY_REFUNDED, and logs audit histories.',
  })
  @ApiResponse({ status: 201, description: 'Refund created and processed' })
  @ApiResponse({
    status: 400,
    description: 'Invalid refund amount or booking not paid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Insufficient privileges',
  })
  createRefund(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: CreateRefundDto,
  ) {
    return this.refundsService.createRefund(userId, userRoles, dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get refund details by ID',
    description:
      'Retrieves the status, amounts, cancellation fee, and gateway refund identifiers for a refund.',
  })
  @ApiResponse({ status: 200, description: 'Refund details' })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  getRefundById(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.refundsService.getRefundById(userId, userRoles, id);
  }
}
