import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { CouponsService } from './coupons.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(
    private readonly couponsService: CouponsService,
    private readonly jwtService: JwtService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List active public coupons',
    description:
      'Returns all active and eligible discount coupons available for customers.',
  })
  @ApiQuery({
    name: 'turfId',
    required: false,
    description: 'Optional turf ID filter',
  })
  @ApiQuery({
    name: 'sportType',
    required: false,
    description: 'Optional sport filter',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active promotional coupons',
  })
  getActiveCoupons(
    @Query('turfId') turfId?: string,
    @Query('sportType') sportType?: string,
  ) {
    return this.couponsService.getActiveCoupons(turfId, sportType);
  }

  @Post('validate')
  @ApiOperation({
    summary: 'Validate coupon and calculate discount',
    description:
      'Validates coupon against 8 rules: expiry, minimum amount, max discount cap, total usage limit, per-user limit, turf restriction, sport restriction, and first booking condition.',
  })
  @ApiResponse({
    status: 200,
    description: 'Coupon validation and discount calculation result',
  })
  validateCoupon(@Body() dto: ValidateCouponDto, @Req() req: any) {
    let userId: string | undefined;
    const authHeader = req.headers?.authorization;
    if (
      authHeader &&
      typeof authHeader === 'string' &&
      authHeader.startsWith('Bearer ')
    ) {
      const token = authHeader.substring(7);
      try {
        const decoded: any = this.jwtService.decode(token);
        userId = decoded?.sub || decoded?.userId;
      } catch {
        // Continue unauthenticated if token cannot be parsed
      }
    }

    return this.couponsService.validateCoupon(dto, userId);
  }
}
