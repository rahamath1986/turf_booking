import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CommissionService } from './commission.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SetOwnerCommissionDto } from './dto/set-commission.dto';
import { SettlementQueryDto } from './dto/settlement-query.dto';
import { ProcessSettlementDto } from './dto/process-settlement.dto';

@ApiTags('Commission')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  // ============================================================================
  // OWNER APIs
  // ============================================================================

  @Get('owner/commission')
  @Roles(Role.TURF_OWNER)
  @ApiOperation({ summary: 'Get my commission rate and earnings summary' })
  getMyCommission(@CurrentUser('userId') userId: string) {
    return this.commissionService.getOwnerCommission(userId);
  }

  @Get('owner/commission/transactions')
  @Roles(Role.TURF_OWNER)
  @ApiOperation({ summary: 'List my commission transactions (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMyCommissionTransactions(
    @CurrentUser('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.commissionService.getOwnerCommissionTransactions(
      userId,
      page,
      limit,
    );
  }

  @Get('owner/settlements')
  @Roles(Role.TURF_OWNER)
  @ApiOperation({ summary: 'List my settlements' })
  getMySettlements(
    @CurrentUser('userId') userId: string,
    @Query() query: SettlementQueryDto,
  ) {
    return this.commissionService.getOwnerSettlements(userId, query);
  }

  @Get('owner/settlements/:id')
  @Roles(Role.TURF_OWNER)
  @ApiOperation({ summary: 'Get a specific settlement with transactions' })
  getMySettlementById(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.commissionService.getOwnerSettlementById(userId, id);
  }

  // ============================================================================
  // ADMIN APIs
  // ============================================================================

  @Get('admin/commission')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform-wide commission summary (Admin)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getAdminCommissionSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.commissionService.getAdminCommissionSummary({
      startDate,
      endDate,
    });
  }

  @Put('admin/owners/:id/commission')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Set commission rate for a specific owner (Admin)' })
  setOwnerCommission(
    @Param('id', ParseUUIDPipe) ownerId: string,
    @Body() dto: SetOwnerCommissionDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.commissionService.setOwnerCommissionRate(
      ownerId,
      dto,
      adminId,
    );
  }

  @Get('admin/settlements')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all settlements (Admin)' })
  @ApiQuery({ name: 'ownerId', required: false })
  getAdminSettlements(
    @Query() query: SettlementQueryDto,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.commissionService.getAdminSettlements({
      ...query,
      ownerId,
    });
  }

  @Post('admin/settlements/generate/:ownerId')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Generate a new settlement for an owner from all unsettled transactions (Admin)',
  })
  generateSettlement(@Param('ownerId', ParseUUIDPipe) ownerId: string) {
    return this.commissionService.createSettlementForOwner(ownerId);
  }

  @Post('admin/settlements/:id/process')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark a settlement as COMPLETED (Admin)' })
  processSettlement(
    @Param('id', ParseUUIDPipe) settlementId: string,
    @Body() dto: ProcessSettlementDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.commissionService.processSettlement(
      settlementId,
      dto,
      adminId,
    );
  }
}
