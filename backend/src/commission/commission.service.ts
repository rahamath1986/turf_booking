import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SetOwnerCommissionDto } from './dto/set-commission.dto';
import { SettlementQueryDto } from './dto/settlement-query.dto';
import { ProcessSettlementDto } from './dto/process-settlement.dto';
import { SettlementStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

const DEFAULT_COMMISSION_RATE = 10.0; // 10% default platform commission

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // COMMISSION CALCULATION (called after booking confirmed)
  // ============================================================================

  /**
   * Creates a CommissionTransaction record for a confirmed booking.
   * Calculates: commission = grossAmount * rate / 100
   *             netOwnerEarning = grossAmount - commissionAmount
   */
  async createCommissionTransaction(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        turf: {
          include: {
            owner: {
              include: { commissionConfig: true },
            },
          },
        },
      },
    });

    if (!booking) {
      this.logger.warn(
        `Commission: booking ${bookingId} not found, skipping.`,
      );
      return;
    }

    // Idempotency check
    const existing = await this.prisma.commissionTransaction.findUnique({
      where: { bookingId },
    });
    if (existing) return;

    const ownerConfig = booking.turf.owner.commissionConfig;
    const rate = ownerConfig?.isActive
      ? Number(ownerConfig.commissionRate)
      : DEFAULT_COMMISSION_RATE;

    const gross = Number(booking.totalPrice);
    const commission = Math.round(gross * (rate / 100) * 100) / 100;
    const net = Math.round((gross - commission) * 100) / 100;

    await this.prisma.commissionTransaction.create({
      data: {
        bookingId,
        turfOwnerId: booking.turf.ownerId,
        commissionConfigId: ownerConfig?.id ?? null,
        grossAmount: gross,
        commissionRate: rate,
        commissionAmount: commission,
        netOwnerEarning: net,
      },
    });

    this.logger.log(
      `Commission recorded: booking=${bookingId} gross=${gross} rate=${rate}% commission=${commission} net=${net}`,
    );
  }

  /**
   * Update commission transaction when a refund is processed.
   * Adjusts netOwnerEarning to account for refunded amount.
   */
  async applyRefundToCommission(
    bookingId: string,
    refundAmount: number,
  ): Promise<void> {
    const tx = await this.prisma.commissionTransaction.findUnique({
      where: { bookingId },
    });
    if (!tx) return;

    const newRefundTotal = Number(tx.refundAmount) + refundAmount;
    const gross = Number(tx.grossAmount);
    const commission = Number(tx.commissionAmount);
    const adj = Number(tx.adjustmentAmount);
    const newNet = Math.max(
      0,
      Math.round((gross - commission - newRefundTotal + adj) * 100) / 100,
    );

    await this.prisma.commissionTransaction.update({
      where: { bookingId },
      data: {
        refundAmount: newRefundTotal,
        netOwnerEarning: newNet,
      },
    });
  }

  // ============================================================================
  // OWNER-FACING COMMISSION APIs
  // ============================================================================

  /**
   * GET /api/v1/owner/commission
   * Returns the current commission config and summary for the requesting owner.
   */
  async getOwnerCommission(userId: string) {
    const owner = await this.prisma.turfOwner.findUnique({
      where: { userId },
      include: { commissionConfig: true },
    });

    if (!owner) {
      throw new NotFoundException('Turf owner profile not found');
    }

    const config = owner.commissionConfig;
    const rate = config?.isActive ? Number(config.commissionRate) : DEFAULT_COMMISSION_RATE;

    // Aggregate totals
    const [totals, pending] = await Promise.all([
      this.prisma.commissionTransaction.aggregate({
        where: { turfOwnerId: owner.id },
        _sum: {
          grossAmount: true,
          commissionAmount: true,
          refundAmount: true,
          netOwnerEarning: true,
        },
        _count: true,
      }),
      this.prisma.commissionTransaction.aggregate({
        where: { turfOwnerId: owner.id, isSettled: false },
        _sum: { netOwnerEarning: true },
        _count: true,
      }),
    ]);

    return {
      commissionRate: rate,
      effectiveFrom: config?.effectiveFrom ?? null,
      notes: config?.notes ?? null,
      totals: {
        transactionCount: totals._count,
        grossAmount: Number(totals._sum.grossAmount ?? 0),
        commissionAmount: Number(totals._sum.commissionAmount ?? 0),
        refundAmount: Number(totals._sum.refundAmount ?? 0),
        netOwnerEarning: Number(totals._sum.netOwnerEarning ?? 0),
      },
      pendingSettlement: {
        transactionCount: pending._count,
        amount: Number(pending._sum.netOwnerEarning ?? 0),
      },
    };
  }

  /**
   * GET /api/v1/owner/commission/transactions
   * Paginated list of commission transactions for the owner.
   */
  async getOwnerCommissionTransactions(
    userId: string,
    page = 1,
    limit = 20,
  ) {
    const owner = await this.prisma.turfOwner.findUnique({ where: { userId } });
    if (!owner) throw new NotFoundException('Turf owner profile not found');

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.commissionTransaction.findMany({
        where: { turfOwnerId: owner.id },
        include: {
          booking: {
            select: {
              bookingNumber: true,
              bookingDate: true,
              startTime: true,
              endTime: true,
              status: true,
              turf: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.commissionTransaction.count({
        where: { turfOwnerId: owner.id },
      }),
    ]);

    return {
      items: items.map((t) => this.formatTransaction(t)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================================
  // OWNER SETTLEMENTS
  // ============================================================================

  /**
   * GET /api/v1/owner/settlements
   * List of settlements for the requesting owner.
   */
  async getOwnerSettlements(userId: string, query: SettlementQueryDto) {
    const owner = await this.prisma.turfOwner.findUnique({ where: { userId } });
    if (!owner) throw new NotFoundException('Turf owner profile not found');

    return this.querySettlements({ turfOwnerId: owner.id }, query);
  }

  /**
   * GET /api/v1/owner/settlements/:id
   */
  async getOwnerSettlementById(userId: string, settlementId: string) {
    const owner = await this.prisma.turfOwner.findUnique({ where: { userId } });
    if (!owner) throw new NotFoundException('Turf owner profile not found');

    const settlement = await this.prisma.settlement.findFirst({
      where: { id: settlementId, turfOwnerId: owner.id },
      include: {
        transactions: {
          include: {
            booking: {
              select: {
                bookingNumber: true,
                bookingDate: true,
                startTime: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!settlement) throw new NotFoundException('Settlement not found');
    return this.formatSettlement(settlement);
  }

  // ============================================================================
  // ADMIN COMMISSION APIs
  // ============================================================================

  /**
   * GET /api/v1/admin/commission
   * Platform-wide commission summary.
   */
  async getAdminCommissionSummary(query: { startDate?: string; endDate?: string }) {
    const where: Prisma.CommissionTransactionWhereInput = {};

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.startDate);
      if (query.endDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(query.endDate);
    }

    const [totals, byOwner] = await Promise.all([
      this.prisma.commissionTransaction.aggregate({
        where,
        _sum: {
          grossAmount: true,
          commissionAmount: true,
          refundAmount: true,
          netOwnerEarning: true,
        },
        _count: true,
      }),
      this.prisma.commissionTransaction.groupBy({
        by: ['turfOwnerId'],
        where,
        _sum: {
          grossAmount: true,
          commissionAmount: true,
          netOwnerEarning: true,
        },
        _count: true,
        orderBy: { _sum: { commissionAmount: 'desc' } },
        take: 10,
      }),
    ]);

    // Enrich with owner names
    const ownerIds = byOwner.map((o) => o.turfOwnerId);
    const owners = await this.prisma.turfOwner.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, businessName: true, userId: true },
    });
    const ownerMap = Object.fromEntries(owners.map((o) => [o.id, o]));

    return {
      totals: {
        transactionCount: totals._count,
        grossAmount: Number(totals._sum.grossAmount ?? 0),
        commissionAmount: Number(totals._sum.commissionAmount ?? 0),
        refundAmount: Number(totals._sum.refundAmount ?? 0),
        netOwnerEarning: Number(totals._sum.netOwnerEarning ?? 0),
      },
      topOwnersByCommission: byOwner.map((o) => ({
        turfOwnerId: o.turfOwnerId,
        businessName: ownerMap[o.turfOwnerId]?.businessName ?? 'Unknown',
        transactionCount: o._count,
        grossAmount: Number(o._sum.grossAmount ?? 0),
        commissionAmount: Number(o._sum.commissionAmount ?? 0),
        netOwnerEarning: Number(o._sum.netOwnerEarning ?? 0),
      })),
    };
  }

  /**
   * PUT /api/v1/admin/owners/:id/commission
   * Set or update commission rate for a specific owner.
   */
  async setOwnerCommissionRate(
    ownerId: string,
    dto: SetOwnerCommissionDto,
    adminUserId: string,
  ) {
    const owner = await this.prisma.turfOwner.findUnique({
      where: { id: ownerId },
    });
    if (!owner) throw new NotFoundException('Turf owner not found');

    const config = await this.prisma.ownerCommissionConfig.upsert({
      where: { turfOwnerId: ownerId },
      create: {
        turfOwnerId: ownerId,
        commissionRate: dto.commissionRate,
        notes: dto.notes,
        setByAdminId: adminUserId,
        effectiveFrom: new Date(),
      },
      update: {
        commissionRate: dto.commissionRate,
        notes: dto.notes,
        setByAdminId: adminUserId,
        effectiveFrom: new Date(),
        isActive: true,
      },
    });

    this.logger.log(
      `Admin ${adminUserId} set commission rate for owner ${ownerId} to ${dto.commissionRate}%`,
    );

    return {
      turfOwnerId: ownerId,
      businessName: owner.businessName,
      commissionRate: Number(config.commissionRate),
      effectiveFrom: config.effectiveFrom,
      notes: config.notes,
    };
  }

  // ============================================================================
  // ADMIN SETTLEMENTS
  // ============================================================================

  /**
   * GET /api/v1/admin/settlements
   * All settlements across the platform.
   */
  async getAdminSettlements(
    query: SettlementQueryDto & { ownerId?: string },
  ) {
    const where: Prisma.SettlementWhereInput = {};
    if (query.ownerId) where.turfOwnerId = query.ownerId;
    return this.querySettlements(where, query);
  }

  /**
   * POST /api/v1/admin/settlements/:id/process
   * Mark a settlement as COMPLETED and link payout details.
   */
  async processSettlement(
    settlementId: string,
    dto: ProcessSettlementDto,
    adminUserId: string,
  ) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) throw new NotFoundException('Settlement not found');

    if (settlement.status === SettlementStatus.COMPLETED) {
      throw new BadRequestException('Settlement is already completed');
    }

    if (
      settlement.status !== SettlementStatus.PENDING &&
      settlement.status !== SettlementStatus.PROCESSING
    ) {
      throw new BadRequestException(
        `Cannot process settlement in status: ${settlement.status}`,
      );
    }

    // Mark all linked transactions as settled
    await this.prisma.$transaction([
      this.prisma.settlement.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.COMPLETED,
          processedAt: new Date(),
          processedByAdminId: adminUserId,
          notes: dto.notes,
        },
      }),
      this.prisma.commissionTransaction.updateMany({
        where: { settlementId },
        data: { isSettled: true },
      }),
    ]);

    this.logger.log(
      `Admin ${adminUserId} processed settlement ${settlementId}`,
    );

    return { message: 'Settlement processed successfully', settlementId };
  }

  /**
   * Utility: create a new settlement for an owner, covering all unsettled transactions.
   * Called either manually by admin or via a cron job.
   */
  async createSettlementForOwner(ownerId: string): Promise<string> {
    const unsettled = await this.prisma.commissionTransaction.findMany({
      where: { turfOwnerId: ownerId, isSettled: false },
    });

    if (unsettled.length === 0) {
      throw new BadRequestException(
        'No unsettled commission transactions found for this owner',
      );
    }

    const gross = unsettled.reduce((s, t) => s + Number(t.grossAmount), 0);
    const commission = unsettled.reduce(
      (s, t) => s + Number(t.commissionAmount),
      0,
    );
    const refund = unsettled.reduce((s, t) => s + Number(t.refundAmount), 0);
    const adj = unsettled.reduce(
      (s, t) => s + Number(t.adjustmentAmount),
      0,
    );
    const net = Math.max(0, gross - commission - refund + adj);

    const settlementNumber = `SET${Date.now()}${randomBytes(3).toString('hex').toUpperCase()}`;
    const dates = unsettled
      .map((t) => t.createdAt)
      .sort((a, b) => a.getTime() - b.getTime());

    const settlement = await this.prisma.$transaction(async (tx) => {
      const s = await tx.settlement.create({
        data: {
          settlementNumber,
          turfOwnerId: ownerId,
          periodStart: dates[0],
          periodEnd: dates[dates.length - 1],
          grossAmount: Math.round(gross * 100) / 100,
          commissionAmount: Math.round(commission * 100) / 100,
          refundAmount: Math.round(refund * 100) / 100,
          adjustmentAmount: Math.round(adj * 100) / 100,
          netPayoutAmount: Math.round(net * 100) / 100,
          transactionCount: unsettled.length,
          status: SettlementStatus.PENDING,
        },
      });

      await tx.commissionTransaction.updateMany({
        where: { id: { in: unsettled.map((t) => t.id) } },
        data: { settlementId: s.id },
      });

      return s;
    });

    this.logger.log(
      `Settlement ${settlementNumber} created for owner ${ownerId}: net=${net}`,
    );
    return settlement.id;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async querySettlements(
    where: Prisma.SettlementWhereInput,
    query: SettlementQueryDto,
  ) {
    if (query.status) where.status = query.status as SettlementStatus;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.startDate);
      if (query.endDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(query.endDate);
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        include: {
          owner: { select: { id: true, businessName: true, userId: true } },
          processedByAdmin: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.settlement.count({ where }),
    ]);

    return {
      items: items.map((s) => this.formatSettlement(s)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private formatTransaction(t: any) {
    return {
      id: t.id,
      bookingId: t.bookingId,
      bookingNumber: t.booking?.bookingNumber,
      bookingDate: t.booking?.bookingDate,
      turfName: t.booking?.turf?.name,
      grossAmount: Number(t.grossAmount),
      commissionRate: Number(t.commissionRate),
      commissionAmount: Number(t.commissionAmount),
      refundAmount: Number(t.refundAmount),
      adjustmentAmount: Number(t.adjustmentAmount),
      netOwnerEarning: Number(t.netOwnerEarning),
      isSettled: t.isSettled,
      settlementId: t.settlementId,
      createdAt: t.createdAt,
    };
  }

  private formatSettlement(s: any) {
    return {
      id: s.id,
      settlementNumber: s.settlementNumber,
      turfOwnerId: s.turfOwnerId,
      businessName: s.owner?.businessName,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      grossAmount: Number(s.grossAmount),
      commissionAmount: Number(s.commissionAmount),
      refundAmount: Number(s.refundAmount),
      adjustmentAmount: Number(s.adjustmentAmount),
      netPayoutAmount: Number(s.netPayoutAmount),
      transactionCount: s.transactionCount,
      status: s.status,
      processedAt: s.processedAt,
      processedBy: s.processedByAdmin?.fullName ?? null,
      notes: s.notes,
      transactions: s.transactions?.map((t: any) => this.formatTransaction(t)),
      createdAt: s.createdAt,
    };
  }
}
