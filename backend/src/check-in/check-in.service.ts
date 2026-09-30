import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../database/prisma.service';

export interface QrTokenPayload {
  bookingId: string;
  bookingNumber: string;
  turfId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  iat: number;
  exp: number;
}

@Injectable()
export class CheckInService {
  private readonly logger = new Logger(CheckInService.name);
  private readonly qrSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.qrSecret =
      this.configService.get<string>('checkin.qrSecret') ||
      'turf-booking-qr-fallback-dev-only-replace-in-production';
    if (
      !this.configService.get<string>('checkin.qrSecret') &&
      process.env.NODE_ENV === 'production'
    ) {
      throw new Error(
        'CHECKIN_QR_SECRET must be set in production environment',
      );
    }
  }

  // ============================================================================
  // TOKEN CRYPTOGRAPHY (HMAC-SHA256 SIGNED & TIMING-SAFE)
  // ============================================================================

  /**
   * Generates a tamper-proof cryptographically signed QR token
   */
  generateSignedToken(payload: QrTokenPayload): string {
    const payloadJson = JSON.stringify(payload);
    const encodedPayload = Buffer.from(payloadJson).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.qrSecret)
      .update(encodedPayload)
      .digest('base64url');

    return `${encodedPayload}.${signature}`;
  }

  /**
   * Verifies the cryptographic integrity and expiration of a QR token
   */
  verifySignedToken(qrToken: string): QrTokenPayload {
    if (!qrToken || typeof qrToken !== 'string') {
      throw new BadRequestException('QR token is missing or malformed');
    }

    const parts = qrToken.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid QR token format');
    }

    const [encodedPayload, receivedSignature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', this.qrSecret)
      .update(encodedPayload)
      .digest('base64url');

    // Timing-safe comparison to prevent side-channel timing attacks
    const receivedBuffer = Buffer.from(receivedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      this.logger.warn(
        'Tampered or invalid QR check-in token signature rejected',
      );
      throw new BadRequestException('Invalid or forged QR token signature');
    }

    let payload: QrTokenPayload;
    try {
      const decodedJson = Buffer.from(encodedPayload, 'base64url').toString(
        'utf8',
      );
      payload = JSON.parse(decodedJson);
    } catch {
      throw new BadRequestException('Corrupted QR token payload');
    }

    // Token Expiration check
    const nowUnix = Math.floor(Date.now() / 1000);
    if (payload.exp && nowUnix > payload.exp) {
      throw new BadRequestException(
        'QR check-in token has expired. Please regenerate your QR code.',
      );
    }

    return payload;
  }

  // ============================================================================
  // APIS
  // ============================================================================

  /**
   * GET /api/v1/bookings/:id/qr
   * Customer retrieves secure, scannable QR token and visual base64 QR code image
   */
  async getBookingQr(
    bookingId: string,
    userId: string,
    userRoles: string[] = [],
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        turf: { select: { id: true, name: true, owner: true } },
        sport: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true, phone: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID '${bookingId}' not found`);
    }

    const isAdmin =
      userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    const isOwner = booking.turf.owner?.userId === userId;
    const isCustomer = booking.userId === userId;

    if (!isCustomer && !isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to access this booking QR code',
      );
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot generate QR code for a cancelled booking',
      );
    }

    const dateStr = booking.bookingDate.toISOString().split('T')[0];
    const nowUnix = Math.floor(Date.now() / 1000);

    // Calculate expiration timestamp: end of booking day or slot end + buffer
    const slotEndTimeParts = booking.endTime.split(':');
    const slotEndHours = parseInt(slotEndTimeParts[0], 10) || 23;
    const slotEndMins = parseInt(slotEndTimeParts[1], 10) || 59;

    const slotEndDate = new Date(booking.bookingDate);
    slotEndDate.setHours(slotEndHours + 4, slotEndMins, 0, 0); // 4h grace after slot end
    const expUnix = Math.max(
      nowUnix + 7200,
      Math.floor(slotEndDate.getTime() / 1000),
    );

    const payload: QrTokenPayload = {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      turfId: booking.turfId,
      bookingDate: dateStr,
      startTime: booking.startTime,
      endTime: booking.endTime,
      iat: nowUnix,
      exp: expUnix,
    };

    const qrToken = this.generateSignedToken(payload);

    // Generate visual QR code as base64 PNG data URL
    let qrCodeDataUrl: string | undefined;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(qrToken, {
        width: 320,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch (err: any) {
      this.logger.warn(`QR visual image generation skipped: ${err.message}`);
    }

    return {
      qrToken,
      qrCodeDataUrl,
      expiresAt: new Date(expUnix * 1000),
      booking: {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        turfId: booking.turfId,
        turfName: booking.turf.name,
        sportName: booking.sport?.name,
        bookingDate: dateStr,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        totalPrice: Number(booking.totalPrice),
        paidAmount: Number(booking.paidAmount || 0),
        remainingAmount: Number(booking.remainingAmount || 0),
        paymentStatus: booking.paymentStatus || 'PAID',
        isAdvanceBooking: Boolean(booking.isAdvanceBooking),
        isCheckedIn: Boolean(booking.checkedInAt),
        checkedInAt: booking.checkedInAt,
        isCheckedOut: Boolean(booking.checkedOutAt),
        checkedOutAt: booking.checkedOutAt,
        timeSlots: (booking as any).timeSlots || null,
      },
    };
  }

  /**
   * POST /api/v1/staff/bookings/scan
   * Staff gatekeeper scans customer QR token
   */
  async scanBookingQr(
    staffUserId: string,
    staffRoles: string[] = [],
    qrToken: string,
    gateTurfId?: string,
    locationData?: {
      latitude?: number;
      longitude?: number;
      location?: string;
      accuracy?: number;
    },
  ) {
    // 1. Verify token cryptographic integrity and expiry
    const payload = this.verifySignedToken(qrToken);

    // 2. Booking validation in database
    const booking = await this.prisma.booking.findUnique({
      where: { id: payload.bookingId },
      include: {
        turf: { include: { owner: true } },
        sport: { select: { id: true, name: true } },
        user: {
          select: { id: true, fullName: true, phone: true, email: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(
        `Booking with ID '${payload.bookingId}' does not exist`,
      );
    }

    if (booking.bookingNumber !== payload.bookingNumber) {
      throw new BadRequestException('QR token booking number mismatch');
    }

    // 3. Turf validation: Staff gate turf validation
    if (gateTurfId && booking.turfId !== gateTurfId) {
      throw new BadRequestException(
        `Wrong venue: This booking is for "${booking.turf.name}", not the scanned gate`,
      );
    }

    // Assert staff/owner authorization for this venue
    const isAdmin =
      staffRoles.includes('ADMIN') || staffRoles.includes('SUPER_ADMIN');
    const isOwner = booking.turf.owner?.userId === staffUserId;
    const isStaff =
      staffRoles.includes('STAFF') || staffRoles.includes('MANAGER');

    if (!isAdmin && !isOwner && !isStaff) {
      throw new ForbiddenException(
        'You are not authorized to scan bookings for this turf venue',
      );
    }

    // 4. Date/Time validation
    const dateValidation = this.validateBookingTimeWindow(
      booking.bookingDate,
      booking.startTime,
      booking.endTime,
    );

    const userLocation =
      locationData &&
      (locationData.latitude !== undefined ||
        locationData.longitude !== undefined ||
        locationData.location)
        ? {
            latitude: locationData.latitude ?? null,
            longitude: locationData.longitude ?? null,
            location: locationData.location ?? null,
            accuracy: locationData.accuracy ?? null,
          }
        : null;

    let distanceFromTurfMeters: number | null = null;
    if (
      userLocation?.latitude != null &&
      userLocation?.longitude != null &&
      booking.turf.latitude != null &&
      booking.turf.longitude != null
    ) {
      distanceFromTurfMeters = this.calculateDistanceMeters(
        Number(userLocation.latitude),
        Number(userLocation.longitude),
        Number(booking.turf.latitude),
        Number(booking.turf.longitude),
      );
    }

    // 5. Audit scan action
    await this.prisma.bookingCheckInAudit.create({
      data: {
        bookingId: booking.id,
        turfId: booking.turfId,
        actionType: 'SCAN',
        performedByUserId: staffUserId,
        notes: `QR scanned by staff. Token valid. Time status: ${dateValidation.status}`,
        metadata: {
          scannedAt: new Date().toISOString(),
          timeStatus: dateValidation.status,
          userLocation,
          distanceFromTurfMeters,
        },
      },
    });

    const isCheckedIn = Boolean(booking.checkedInAt);
    const isCheckedOut = Boolean(booking.checkedOutAt);
    const canCheckIn =
      !isCheckedIn &&
      (booking.status === BookingStatus.CONFIRMED ||
        booking.status === BookingStatus.COMPLETED);
    const canCheckOut = isCheckedIn && !isCheckedOut;

    return {
      valid: true,
      message: dateValidation.message,
      timeStatus: dateValidation.status,
      userLocation,
      distanceFromTurfMeters,
      booking: {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        turfId: booking.turfId,
        turfName: booking.turf.name,
        sportName: booking.sport?.name,
        bookingDate: booking.bookingDate.toISOString().split('T')[0],
        startTime: booking.startTime,
        endTime: booking.endTime,
        durationMinutes: booking.durationMinutes,
        status: booking.status,
        totalPrice: Number(booking.totalPrice),
        paidAmount: Number(booking.paidAmount || 0),
        remainingAmount: Number(booking.remainingAmount || 0),
        paymentStatus: booking.paymentStatus || 'PAID',
        isAdvanceBooking: Boolean(booking.isAdvanceBooking),
        balanceDue: Number(booking.remainingAmount || 0),
        balanceAlert:
          Number(booking.remainingAmount || 0) > 0
            ? `⚠️ Balance amount of ₹${booking.remainingAmount} is pending for this advance booking.`
            : null,
        timeSlots: (booking as any).timeSlots || null,
      },
      customer: {
        id: booking.user.id,
        fullName: booking.user.fullName,
        phone: booking.user.phone,
        email: booking.user.email,
      },
      checkInStatus: {
        isCheckedIn,
        checkedInAt: booking.checkedInAt,
        isCheckedOut,
        checkedOutAt: booking.checkedOutAt,
        canCheckIn,
        canCheckOut,
        balanceDue: Number(booking.remainingAmount || 0),
        paymentStatus: booking.paymentStatus || 'PAID',
      },
    };
  }

  /**
   * POST /api/v1/bookings/:id/check-in
   * Check in customer to venue
   */
  async checkIn(
    bookingId: string,
    performedByUserId: string,
    userRoles: string[] = [],
    notes?: string,
    locationData?: {
      latitude?: number;
      longitude?: number;
      location?: string;
      accuracy?: number;
    },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        turf: { include: { owner: true } },
        user: { select: { id: true, fullName: true, phone: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID '${bookingId}' not found`);
    }

    // Authorization: Staff, Turf Owner, Admin, or the Customer themselves
    const isAdmin =
      userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    const isOwner = booking.turf.owner?.userId === performedByUserId;
    const isCustomer = booking.userId === performedByUserId;
    const isStaff =
      userRoles.includes('STAFF') || userRoles.includes('MANAGER');

    if (!isCustomer && !isOwner && !isStaff && !isAdmin) {
      throw new ForbiddenException(
        'Not authorized to check in for this booking',
      );
    }

    // 1. Status validation
    if (
      booking.status !== BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot check in a booking with status "${booking.status}"`,
      );
    }

    // 2. Prevent duplicate check-in
    if (booking.checkedInAt) {
      throw new BadRequestException(
        `Booking is already checked in at ${booking.checkedInAt.toISOString()}`,
      );
    }

    // 3. Date/Time validation
    const dateValidation = this.validateBookingTimeWindow(
      booking.bookingDate,
      booking.startTime,
      booking.endTime,
    );

    if (dateValidation.status === 'TOO_EARLY') {
      throw new BadRequestException(dateValidation.message);
    }

    if (dateValidation.status === 'TOO_LATE') {
      throw new BadRequestException(dateValidation.message);
    }

    const userLocation =
      locationData &&
      (locationData.latitude !== undefined ||
        locationData.longitude !== undefined ||
        locationData.location)
        ? {
            latitude: locationData.latitude ?? null,
            longitude: locationData.longitude ?? null,
            location: locationData.location ?? null,
            accuracy: locationData.accuracy ?? null,
          }
        : null;

    let distanceFromTurfMeters: number | null = null;
    if (
      userLocation?.latitude != null &&
      userLocation?.longitude != null &&
      booking.turf.latitude != null &&
      booking.turf.longitude != null
    ) {
      distanceFromTurfMeters = this.calculateDistanceMeters(
        Number(userLocation.latitude),
        Number(userLocation.longitude),
        Number(booking.turf.latitude),
        Number(booking.turf.longitude),
      );
    }

    // 4. Perform atomic Check-in transaction
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.booking.update({
        where: { id: bookingId },
        data: {
          checkedInAt: now,
          checkedInByUserId: performedByUserId,
        },
      });

      // Check-in audit record
      await tx.bookingCheckInAudit.create({
        data: {
          bookingId,
          turfId: booking.turfId,
          actionType: 'CHECK_IN',
          performedByUserId,
          notes: notes || 'Customer checked in at venue',
          metadata: {
            checkedInAt: now.toISOString(),
            performedByRole: userRoles[0] || 'CUSTOMER',
            userLocation,
            distanceFromTurfMeters,
          },
        },
      });

      // Status history audit
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: booking.status,
          toStatus: booking.status,
          reason: `Customer checked in. ${notes ? `Remarks: ${notes}` : ''}`,
          changedByUserId: performedByUserId,
        },
      });

      return res;
    });

    this.logger.log(
      `Booking ${booking.bookingNumber} checked in by user ${performedByUserId}`,
    );

    return {
      message: 'Check-in successful',
      userLocation,
      distanceFromTurfMeters,
      timestamp: now.toISOString(),
      booking: {
        id: updated.id,
        bookingNumber: updated.bookingNumber,
        status: updated.status,
        paidAmount: Number(updated.paidAmount || 0),
        remainingAmount: Number(updated.remainingAmount || 0),
        paymentStatus: updated.paymentStatus || 'PAID',
        isAdvanceBooking: Boolean(updated.isAdvanceBooking),
        balanceDue: Number(updated.remainingAmount || 0),
        checkedInAt: updated.checkedInAt,
        checkedInByUserId: updated.checkedInByUserId,
      },
    };
  }

  /**
   * POST /api/v1/bookings/:id/check-out
   * Check out customer and mark booking completed
   */
  async checkOut(
    bookingId: string,
    performedByUserId: string,
    userRoles: string[] = [],
    notes?: string,
    locationData?: {
      latitude?: number;
      longitude?: number;
      location?: string;
      accuracy?: number;
    },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        turf: { include: { owner: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID '${bookingId}' not found`);
    }

    const isAdmin =
      userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    const isOwner = booking.turf.owner?.userId === performedByUserId;
    const isCustomer = booking.userId === performedByUserId;
    const isStaff =
      userRoles.includes('STAFF') || userRoles.includes('MANAGER');

    if (!isCustomer && !isOwner && !isStaff && !isAdmin) {
      throw new ForbiddenException(
        'Not authorized to check out for this booking',
      );
    }

    // 1. Must be checked in first
    if (!booking.checkedInAt) {
      throw new BadRequestException(
        'Cannot check out: Booking has not been checked in yet',
      );
    }

    // 2. Prevent duplicate check-out
    if (booking.checkedOutAt) {
      throw new BadRequestException(
        `Booking is already checked out at ${booking.checkedOutAt.toISOString()}`,
      );
    }

    const userLocation =
      locationData &&
      (locationData.latitude !== undefined ||
        locationData.longitude !== undefined ||
        locationData.location)
        ? {
            latitude: locationData.latitude ?? null,
            longitude: locationData.longitude ?? null,
            location: locationData.location ?? null,
            accuracy: locationData.accuracy ?? null,
          }
        : null;

    let distanceFromTurfMeters: number | null = null;
    if (
      userLocation?.latitude != null &&
      userLocation?.longitude != null &&
      booking.turf.latitude != null &&
      booking.turf.longitude != null
    ) {
      distanceFromTurfMeters = this.calculateDistanceMeters(
        Number(userLocation.latitude),
        Number(userLocation.longitude),
        Number(booking.turf.latitude),
        Number(booking.turf.longitude),
      );
    }

    // 3. Perform atomic Check-out transaction
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.booking.update({
        where: { id: bookingId },
        data: {
          checkedOutAt: now,
          checkedOutByUserId: performedByUserId,
          status: BookingStatus.COMPLETED,
        },
      });

      await tx.bookingCheckInAudit.create({
        data: {
          bookingId,
          turfId: booking.turfId,
          actionType: 'CHECK_OUT',
          performedByUserId,
          notes: notes || 'Customer checked out from venue',
          metadata: {
            checkedOutAt: now.toISOString(),
            userLocation,
            distanceFromTurfMeters,
          },
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.COMPLETED,
          reason: `Customer checked out and match concluded. ${notes ? `Remarks: ${notes}` : ''}`,
          changedByUserId: performedByUserId,
        },
      });

      return res;
    });

    this.logger.log(
      `Booking ${booking.bookingNumber} checked out by user ${performedByUserId}`,
    );

    return {
      message: 'Check-out completed successfully',
      userLocation,
      distanceFromTurfMeters,
      timestamp: now.toISOString(),
      booking: {
        id: updated.id,
        bookingNumber: updated.bookingNumber,
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        checkedOutAt: updated.checkedOutAt,
        checkedOutByUserId: updated.checkedOutByUserId,
      },
    };
  }

  /**
   * GET /api/v1/bookings/:id/check-in-status
   * Full check-in inquiry and audit history
   */
  async getCheckInStatus(
    bookingId: string,
    userId: string,
    userRoles: string[] = [],
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        turf: { select: { id: true, name: true, owner: true } },
        checkInAudits: {
          orderBy: { performedAt: 'desc' },
          include: {
            performedBy: { select: { id: true, fullName: true, phone: true } },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID '${bookingId}' not found`);
    }

    const isAdmin =
      userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    const isOwner = booking.turf.owner?.userId === userId;
    const isCustomer = booking.userId === userId;
    const isStaff =
      userRoles.includes('STAFF') || userRoles.includes('MANAGER');

    if (!isCustomer && !isOwner && !isStaff && !isAdmin) {
      throw new ForbiddenException('Not authorized to view check-in status');
    }

    const isCheckedIn = Boolean(booking.checkedInAt);
    const isCheckedOut = Boolean(booking.checkedOutAt);

    const checkInAudit = booking.checkInAudits.find(
      (a) => a.actionType === 'CHECK_IN',
    );
    const checkInMeta: any = checkInAudit?.metadata || {};
    const checkInLocation = checkInMeta.userLocation || null;
    const distanceFromTurfMeters = checkInMeta.distanceFromTurfMeters ?? null;

    return {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      turfName: booking.turf.name,
      status: booking.status,
      isCheckedIn,
      checkedInAt: booking.checkedInAt,
      checkedInByUserId: booking.checkedInByUserId,
      checkInLocation,
      distanceFromTurfMeters,
      isCheckedOut,
      checkedOutAt: booking.checkedOutAt,
      checkedOutByUserId: booking.checkedOutByUserId,
      audits: booking.checkInAudits.map((a) => {
        const meta: any = a.metadata || {};
        return {
          id: a.id,
          actionType: a.actionType,
          performedAt: a.performedAt,
          performedBy: a.performedBy
            ? { id: a.performedBy.id, fullName: a.performedBy.fullName }
            : null,
          notes: a.notes,
          userLocation: meta.userLocation || null,
          distanceFromTurfMeters: meta.distanceFromTurfMeters ?? null,
        };
      }),
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Validates whether current time falls within valid booking check-in window
   */
  private validateBookingTimeWindow(
    bookingDate: Date,
    startTime: string,
    endTime: string,
  ): {
    status: 'ON_TIME' | 'EARLY' | 'TOO_EARLY' | 'LATE' | 'TOO_LATE';
    message: string;
  } {
    const now = new Date();

    const startParts = startTime.split(':').map((p) => parseInt(p, 10));
    const endParts = endTime.split(':').map((p) => parseInt(p, 10));

    const slotStart = new Date(bookingDate);
    slotStart.setHours(startParts[0] || 0, startParts[1] || 0, 0, 0);

    const slotEnd = new Date(bookingDate);
    slotEnd.setHours(endParts[0] || 23, endParts[1] || 59, 0, 0);

    // Allowed check-in: from 2 hours before start until 2 hours after end
    const earliestCheckIn = new Date(slotStart.getTime() - 2 * 60 * 60 * 1000);
    const latestCheckIn = new Date(slotEnd.getTime() + 2 * 60 * 60 * 1000);

    if (now < earliestCheckIn) {
      return {
        status: 'TOO_EARLY',
        message: `Too early: Check-in opens 2 hours before game start (${startTime})`,
      };
    }

    if (now > latestCheckIn) {
      return {
        status: 'TOO_LATE',
        message: 'Slot match time has already ended',
      };
    }

    if (now < slotStart) {
      return {
        status: 'EARLY',
        message: 'Checked in ahead of game time. Welcome to venue!',
      };
    }

    return {
      status: 'ON_TIME',
      message: 'Checked in on schedule. Have a great match!',
    };
  }

  /**
   * Calculates geodesic distance between two latitude/longitude points in meters using Haversine formula
   */
  calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }
}
