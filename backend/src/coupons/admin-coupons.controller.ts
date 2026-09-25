import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Admin Coupons')
@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new coupon promotion',
    description:
      'Creates a discount coupon with rules including expiry, limits, restrictions, and first-booking requirement.',
  })
  @ApiResponse({ status: 201, description: 'Coupon created successfully' })
  @ApiResponse({ status: 409, description: 'Coupon code already exists' })
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.couponsService.createCoupon(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all coupons (Admin)',
    description:
      'Returns paginated list of all promo coupons with total redemption metrics and active filters.',
  })
  @ApiResponse({ status: 200, description: 'List of all system coupons' })
  findAllAdmin(@Query() query: CouponQueryDto) {
    return this.couponsService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get coupon details and redemption log (Admin)',
    description:
      'Retrieves complete coupon configuration and audit trail of redemptions.',
  })
  @ApiResponse({ status: 200, description: 'Coupon details' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  findOneAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponsService.findOneAdmin(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update coupon configuration (Admin)',
    description:
      'Modifies coupon limits, dates, percentage/flat values, and restrictions.',
  })
  @ApiResponse({ status: 200, description: 'Coupon updated successfully' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  updateCoupon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.couponsService.updateCoupon(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete coupon (Admin)',
    description: 'Deletes a coupon and its configuration from the platform.',
  })
  @ApiResponse({ status: 200, description: 'Coupon deleted successfully' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  deleteCoupon(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponsService.deleteCoupon(id);
  }
}
