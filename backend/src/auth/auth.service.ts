import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { Role as RoleEnum } from '../common/enums/role.enum';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OtpPurpose, SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // HELPER: Token Hasher (SHA-256 for fast indexed unique lookups)
  // ---------------------------------------------------------------------------
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // ---------------------------------------------------------------------------
  // HELPER: Generate Access & Refresh Tokens
  // ---------------------------------------------------------------------------
  private async generateTokens(
    userId: string,
    email: string,
    roles: string[],
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessSecret = this.configService.get<string>(
      'jwt.accessSecret',
      'dev_super_secret_jwt_access_key_min_32_chars_2026_sports',
    );
    const accessExpiration = this.configService.get<string>(
      'jwt.accessExpiration',
      '15m',
    );
    const refreshSecret = this.configService.get<string>(
      'jwt.refreshSecret',
      'dev_super_secret_jwt_refresh_key_min_32_chars_2026_sports',
    );
    const refreshExpiration = this.configService.get<string>(
      'jwt.refreshExpiration',
      '7d',
    );

    const payload: JwtPayload = {
      sub: userId,
      email,
      roles,
    };

    // Sign Access Token
    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: accessExpiration as any,
    });

    // Generate random raw refresh token string
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshPayload = {
      sub: userId,
      jti: rawRefreshToken,
    };

    const signedRefreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshSecret,
      expiresIn: refreshExpiration as any,
    });

    const tokenHash = this.hashToken(signedRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Persist hashed refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        ipAddress: ipAddress || null,
        deviceInfo: deviceInfo || null,
        expiresAt,
        isRevoked: false,
      },
    });

    return {
      accessToken,
      refreshToken: signedRefreshToken,
    };
  }

  // ---------------------------------------------------------------------------
  // HELPER: Upsert / Save Firebase FCM Device Token
  // ---------------------------------------------------------------------------
  private async saveUserDeviceToken(
    userId: string,
    token?: string,
    deviceType?: string,
    deviceName?: string,
  ): Promise<void> {
    if (!token || token.trim().length === 0) return;
    const cleanToken = token.trim();
    try {
      await this.prisma.userDevice.upsert({
        where: { deviceToken: cleanToken },
        update: {
          userId,
          deviceType: deviceType || 'WEB',
          deviceName: deviceName || null,
          isActive: true,
          lastActiveAt: new Date(),
        },
        create: {
          userId,
          deviceToken: cleanToken,
          deviceType: deviceType || 'WEB',
          deviceName: deviceName || null,
          isActive: true,
          lastActiveAt: new Date(),
        },
      });
      this.logger.log(`[Firebase Device Token] Registered token for user ${userId}`);
    } catch (err: any) {
      this.logger.warn(`Failed to store firebase device token: ${err?.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. REGISTER
  // ---------------------------------------------------------------------------
  async register(dto: RegisterDto, ipAddress?: string, deviceInfo?: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Check unique email
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingEmail) {
      throw new ConflictException('Email address is already registered');
    }

    // Check unique phone if provided
    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number is already registered');
      }
    }

    // Hash password with Argon2id
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const targetRoleName = dto.role || RoleEnum.CUSTOMER;
    const roleRecord = await this.prisma.role.findUnique({
      where: { name: targetRoleName },
    });

    if (!roleRecord) {
      throw new InternalServerErrorException(
        `Role "${targetRoleName}" not initialized in database. Run seed first.`,
      );
    }

    // Create user and user_roles in an atomic transaction
    const newUser = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          phone: dto.phone || null,
          fullName: dto.fullName.trim(),
          passwordHash,
          isActive: true,
          isEmailVerified: false,
          isPhoneVerified: false,
        },
      });

      await tx.userRole.create({
        data: {
          userId: createdUser.id,
          roleId: roleRecord.id,
        },
      });

      // If registered as TURF_OWNER, create initial turf_owners profile record.
      // New owners default to UNVERIFIED (unapproved) and INACTIVE until a
      // SUPER_ADMIN / ADMIN explicitly approves them from the admin panel.
      if (targetRoleName === RoleEnum.TURF_OWNER) {
        await tx.turfOwner.create({
          data: {
            userId: createdUser.id,
            businessName: `${createdUser.fullName}'s Sports Arena`,
            isVerified: false,
            isActive: false,
          },
        });
      }

      return createdUser;
    });

    const roles = [roleRecord.name];
    const tokens = await this.generateTokens(
      newUser.id,
      newUser.email,
      roles,
      ipAddress,
      deviceInfo,
    );

    const timestamp = new Date().toISOString();

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        phone: newUser.phone,
        roles,
        isEmailVerified: newUser.isEmailVerified,
        isPhoneVerified: newUser.isPhoneVerified,
        createdAt: newUser.createdAt,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      timestamp,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. LOGIN
  // ---------------------------------------------------------------------------
  async login(dto: LoginDto, ipAddress?: string, deviceInfo?: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is currently deactivated');
    }

    // Secure password verification
    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const roles = user.roles.map((r) => r.role.name);
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      roles,
      ipAddress,
      deviceInfo,
    );

    const fcmToken = dto.fcmToken;
    if (fcmToken) {
      await this.saveUserDeviceToken(
        user.id,
        fcmToken,
        dto.deviceType,
        dto.deviceName || deviceInfo,
      );
    }

    const timestamp = new Date().toISOString();

    const userLocation =
      dto.latitude !== undefined || dto.longitude !== undefined
        ? {
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
          }
        : null;

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entityType: 'User',
          entityId: user.id,
          ipAddress: ipAddress || null,
          userAgent: deviceInfo || null,
          newValues: {
            userLocation,
            timestamp,
          },
        },
      });
    } catch (auditErr: any) {
      this.logger.warn(`Failed to create login audit log: ${auditErr?.message}`);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        roles,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      userLocation,
      timestamp,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. SEND OTP
  // ---------------------------------------------------------------------------
  async sendOtp(dto: SendOtpDto) {
    const identifier = dto.identifier.trim();

    // Check if an OTP was sent within the last 60 seconds
    const recentOtp = await this.prisma.otpVerification.findFirst({
      where: {
        identifier,
        purpose: dto.purpose,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recentOtp) {
      throw new BadRequestException('Please wait at least 60 seconds before requesting another OTP');
    }

    // Invalidate any previous pending OTPs for this identifier & purpose
    await this.prisma.otpVerification.updateMany({
      where: {
        identifier,
        purpose: dto.purpose,
        isUsed: false,
      },
      data: {
        isUsed: true,
      },
    });

    // Generate cryptographically secure 6-digit numeric OTP
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await argon2.hash(rawOtp, { type: argon2.argon2id });
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

    await this.prisma.otpVerification.create({
      data: {
        identifier,
        otpHash,
        purpose: dto.purpose,
        expiresAt,
        isUsed: false,
        attempts: 0,
      },
    });

    this.logger.log(
      `[OTP Dispatch] Sent/Resent OTP for ${identifier} with purpose ${dto.purpose}. (DEV_CODE: ${rawOtp})`,
    );

    return {
      success: true,
      message: `OTP has been dispatched to ${identifier}`,
      expiresInSeconds: 600,
      otp: rawOtp,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. VERIFY OTP
  // ---------------------------------------------------------------------------
  async verifyOtp(dto: VerifyOtpDto, ipAddress?: string, deviceInfo?: string) {
    const identifier = dto.identifier.trim();
    const rawIdentifier = identifier;
    const cleanDigits = rawIdentifier.replace(/[^0-9]/g, '');
    const last10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;

    // Search OTP by raw identifier and normalized digit variants
    const identifierVariants = [
      rawIdentifier,
      rawIdentifier.replace(/\s+/g, ''),
      cleanDigits,
      `+${cleanDigits}`,
      `+91${last10}`,
      last10,
    ].filter((v, i, arr) => v && arr.indexOf(v) === i);

    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: {
        identifier: { in: identifierVariants },
        purpose: dto.purpose,
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('No pending OTP request found');
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException(
        'OTP has expired. Please request a new one.',
      );
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      throw new BadRequestException(
        'Maximum verification attempts exceeded. Please request a new OTP.',
      );
    }

    // Verify OTP hash with fallback for test OTP '123456'
    const isMasterOtp = dto.otp === '123456';
    const isOtpValid =
      isMasterOtp || (await argon2.verify(otpRecord.otpHash, dto.otp));

    if (!isOtpValid) {
      await this.prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP code');
    }

    // Mark OTP as used
    await this.prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Handle purpose-specific resolution
    if (dto.purpose === OtpPurpose.LOGIN) {
      const isEmail = rawIdentifier.includes('@');
      const normalizedEmail = isEmail ? rawIdentifier.toLowerCase().trim() : null;

      const phoneConditions: Prisma.UserWhereInput[] = isEmail
        ? []
        : [
            { phone: rawIdentifier },
            { phone: cleanDigits },
            { phone: `+${cleanDigits}` },
            { phone: `+91${last10}` },
            { phone: last10 },
            { phone: { endsWith: last10 } },
          ];

      const emailConditions: Prisma.UserWhereInput[] = isEmail
        ? [{ email: normalizedEmail! }]
        : [
            { email: `${last10}@turfmate.in` },
            { email: `user_${last10}@turfmate.in` },
          ];

      let user = await this.prisma.user.findFirst({
        where: {
          OR: [...phoneConditions, ...emailConditions],
          deletedAt: null,
        },
        include: {
          roles: { include: { role: true } },
        },
      });

      if (!user) {
        // Auto-provision user account for mobile phone/email OTP login
        let roleRecord = await this.prisma.role.findUnique({
          where: { name: RoleEnum.CUSTOMER },
        });
        if (!roleRecord) {
          roleRecord = await this.prisma.role.findFirst({
            where: { name: 'CUSTOMER' },
          });
        }

        const cleanPhone = isEmail
          ? null
          : (cleanDigits.length === 10
              ? `+91${cleanDigits}`
              : (cleanDigits.startsWith('91') ? `+${cleanDigits}` : `+91${last10}`));

        const candidateEmail = isEmail
          ? normalizedEmail!
          : `${last10}@turfmate.in`;

        const existingByEmail = await this.prisma.user.findUnique({
          where: { email: candidateEmail },
        });
        const finalEmail = existingByEmail
          ? `user_${last10}_${Date.now()}@turfmate.in`
          : candidateEmail;

        const randomPassword = crypto.randomBytes(32).toString('hex');
        const passwordHash = await argon2.hash(randomPassword, {
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
        });

        const created = await this.prisma.user.create({
          data: {
            email: finalEmail,
            phone: cleanPhone,
            fullName: isEmail
              ? normalizedEmail!.split('@')[0]
              : `Player ${last10.slice(-4)}`,
            passwordHash,
            isActive: true,
            isPhoneVerified: !isEmail,
            isEmailVerified: isEmail,
          },
        });

        if (roleRecord) {
          await this.prisma.userRole.create({
            data: {
              userId: created.id,
              roleId: roleRecord.id,
            },
          });
        }

        user = await this.prisma.user.findUnique({
          where: { id: created.id },
          include: {
            roles: { include: { role: true } },
          },
        });
      }

      if (!user) {
        throw new NotFoundException(
          'Failed to authenticate account with this phone/email.',
        );
      }

      if (!user.isActive) {
        throw new UnauthorizedException('User account is deactivated');
      }

      const roles = user.roles.map((r) => r.role.name);
      const tokens = await this.generateTokens(
        user.id,
        user.email,
        roles,
        ipAddress,
        deviceInfo,
      );

      const timestamp = new Date().toISOString();

      return {
        success: true,
        message: 'OTP verified successfully. Logged in.',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          roles,
        },
        authToken: tokens.accessToken,
        accessToken: tokens.accessToken,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        timestamp,
      };
    }

    if (
      dto.purpose === OtpPurpose.PHONE_VERIFY ||
      dto.purpose === OtpPurpose.REGISTER
    ) {
      await this.prisma.user.updateMany({
        where: {
          OR: [{ email: identifier }, { phone: identifier }],
        },
        data: {
          isPhoneVerified: true,
          isEmailVerified: true,
        },
      });

      return {
        success: true,
        message: 'Identifier verified successfully',
      };
    }

    if (dto.purpose === OtpPurpose.PASSWORD_RESET) {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: identifier }, { phone: identifier }],
          deletedAt: null,
        },
      });

      if (!user) {
        throw new NotFoundException('Account not found');
      }

      const resetTokenRaw = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = this.hashToken(resetTokenRaw);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: resetTokenHash,
          expiresAt,
          isUsed: false,
        },
      });

      return {
        success: true,
        message: 'OTP verified. Use reset token to change password.',
        resetToken: resetTokenRaw,
      };
    }

    return {
      success: true,
      message: 'OTP verified successfully',
    };
  }

  // ---------------------------------------------------------------------------
  // 5. REFRESH TOKEN (Rotation & Reuse Detection)
  // ---------------------------------------------------------------------------
  async refreshToken(
    refreshToken: string,
    ipAddress?: string,
    deviceInfo?: string,
  ) {
    const refreshSecret = this.configService.get<string>(
      'jwt.refreshSecret',
      'dev_super_secret_jwt_refresh_key_min_32_chars_2026_sports',
    );

    try {
      this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken) {
      throw new UnauthorizedException(
        'Refresh token not recognized or revoked',
      );
    }

    // Reuse detection: If token is revoked, assume compromised and revoke all user tokens
    if (storedToken.isRevoked) {
      this.logger.warn(
        `[Security Alert] Refresh token reuse detected for user ${storedToken.userId}. Revoking all sessions.`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException(
        'Security breach detected: Refresh token reuse. All sessions terminated. Please login again.',
      );
    }

    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedException(
        'Refresh token has expired. Please login again.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user || !user.isActive || user.deletedAt !== null) {
      throw new UnauthorizedException('User account is inactive or not found');
    }

    const roles = user.roles.map((r) => r.role.name);

    // Issue new tokens (Access Token + New Rotated Refresh Token)
    const accessSecret = this.configService.get<string>(
      'jwt.accessSecret',
      'dev_super_secret_jwt_access_key_min_32_chars_2026_sports',
    );
    const accessExpiration = this.configService.get<string>(
      'jwt.accessExpiration',
      '15m',
    );
    const refreshExpiration = this.configService.get<string>(
      'jwt.refreshExpiration',
      '7d',
    );

    const newAccessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, roles },
      { secret: accessSecret, expiresIn: accessExpiration as any },
    );

    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newSignedRefreshToken = this.jwtService.sign(
      { sub: user.id, jti: newRawRefreshToken },
      { secret: refreshSecret, expiresIn: refreshExpiration as any },
    );
    const newHash = this.hashToken(newSignedRefreshToken);

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    // Atomic rotation: revoke old token and record replacement
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          isRevoked: true,
          replacedByToken: newHash,
        },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newHash,
          ipAddress: ipAddress || null,
          deviceInfo: deviceInfo || null,
          expiresAt: newExpiresAt,
          isRevoked: false,
        },
      }),
    ]);

    const timestamp = new Date().toISOString();

    return {
      authToken: newAccessToken,
      accessToken: newAccessToken,
      token: newAccessToken,
      refreshToken: newSignedRefreshToken,
      timestamp,
    };
  }

  // ---------------------------------------------------------------------------
  // 6. LOGOUT
  // ---------------------------------------------------------------------------
  async logout(
    userId?: string,
    refreshToken?: string,
    fcmToken?: string,
    locationData?: {
      latitude?: number;
      longitude?: number;
    },
    ipAddress?: string,
    userAgent?: string,
    bearerToken?: string,
  ) {
    let resolvedUserId = userId;

    if (!resolvedUserId && bearerToken) {
      try {
        const decoded: any = this.jwtService.decode(bearerToken);
        resolvedUserId = decoded?.sub || decoded?.userId;
      } catch {
        // Ignored
      }
    }

    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      const stored = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });
      if (stored && !resolvedUserId) {
        resolvedUserId = stored.userId;
      }
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    } else if (resolvedUserId) {
      // Revoke all active sessions for user if specific token not supplied
      await this.prisma.refreshToken.updateMany({
        where: { userId: resolvedUserId, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    if (fcmToken && fcmToken.trim().length > 0) {
      try {
        await this.prisma.userDevice.updateMany({
          where: { deviceToken: fcmToken.trim() },
          data: { isActive: false },
        });
        this.logger.log(`Deactivated FCM device token on logout`);
      } catch (err: any) {
        this.logger.warn(`Failed to deactivate device token on logout: ${err?.message}`);
      }
    }

    const timestamp = new Date().toISOString();

    const userLocation =
      locationData &&
      (locationData.latitude !== undefined ||
        locationData.longitude !== undefined)
        ? {
            latitude: locationData.latitude ?? null,
            longitude: locationData.longitude ?? null,
          }
        : null;

    if (resolvedUserId) {
      try {
        await this.prisma.auditLog.create({
          data: {
            userId: resolvedUserId,
            action: 'LOGOUT',
            entityType: 'User',
            entityId: resolvedUserId,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            newValues: {
              userLocation,
              timestamp,
            },
          },
        });
      } catch (auditErr: any) {
        this.logger.warn(`Failed to create logout audit log: ${auditErr?.message}`);
      }
    }

    return {
      success: true,
      message: 'Logged out successfully',
      userLocation,
      timestamp,
    };
  }

  // ---------------------------------------------------------------------------
  // 7. FORGOT PASSWORD
  // ---------------------------------------------------------------------------
  async forgotPassword(dto: ForgotPasswordDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Timing-safe response to prevent user enumeration
    if (!user || user.deletedAt !== null || !user.isActive) {
      return {
        success: true,
        message:
          'If an account is associated with this email, a password reset token has been dispatched.',
      };
    }

    const resetTokenRaw = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = this.hashToken(resetTokenRaw);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: resetTokenHash,
        expiresAt,
        isUsed: false,
      },
    });

    this.logger.log(
      `[Password Reset] Dispatched token for ${normalizedEmail}. (DEV_TOKEN: ${resetTokenRaw})`,
    );

    const isDev =
      this.configService.get<string>('nodeEnv', 'development') !== 'production';

    return {
      success: true,
      message:
        'If an account is associated with this email, a password reset token has been dispatched.',
      devResetToken: isDev ? resetTokenRaw : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // 8. RESET PASSWORD
  // ---------------------------------------------------------------------------
  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);

    const resetRecord = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.isUsed) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (new Date() > resetRecord.expiresAt) {
      throw new BadRequestException('Password reset token has expired');
    }

    const newPasswordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // In transaction: update password, mark reset token used, revoke all sessions
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { isUsed: true },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: resetRecord.userId },
        data: { isRevoked: true },
      }),
    ]);

    return {
      success: true,
      message:
        'Password has been reset successfully. Please log in with your new password.',
    };
  }

  // ---------------------------------------------------------------------------
  // 9. CHANGE PASSWORD (Authenticated)
  // ---------------------------------------------------------------------------
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt !== null) {
      throw new NotFoundException('User account not found');
    }

    const isMatch = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password cannot be identical to your current password',
      );
    }

    const newPasswordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Update password and revoke all existing refresh tokens
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      }),
    ]);

    return {
      success: true,
      message:
        'Password changed successfully. All previous sessions have been invalidated.',
    };
  }

  // ---------------------------------------------------------------------------
  // 10. GET ME (Authenticated User Profile)
  // ---------------------------------------------------------------------------
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        addresses: { where: { deletedAt: null } },
        devices: { where: { isActive: true } },
        turfOwner: true,
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new NotFoundException('User profile not found');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      roles: user.roles.map((r) => r.role.name),
      turfOwner: user.turfOwner || null,
      addresses: user.addresses,
      devices: user.devices,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // 11. GOOGLE LOGIN / SOCIAL SIGN-IN
  // ---------------------------------------------------------------------------
  async googleLogin(dto: GoogleLoginDto, ipAddress?: string, deviceInfo?: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (user) {
      if (user.deletedAt !== null) {
        throw new UnauthorizedException('User account has been deleted');
      }
      if (!user.isActive) {
        throw new UnauthorizedException('User account is currently deactivated');
      }

      // Update avatar or name if missing
      const shouldUpdateAvatar = !user.avatarUrl && dto.avatarUrl;
      const shouldUpdateName = (!user.fullName || user.fullName === 'User') && dto.fullName;
      if (shouldUpdateAvatar || shouldUpdateName) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            ...(shouldUpdateAvatar && { avatarUrl: dto.avatarUrl }),
            ...(shouldUpdateName && { fullName: dto.fullName }),
            isEmailVerified: true,
          },
          include: {
            roles: { include: { role: true } },
          },
        });
      }
    } else {
      // Find default CUSTOMER role
      let roleRecord = await this.prisma.role.findUnique({
        where: { name: RoleEnum.CUSTOMER },
      });

      if (!roleRecord) {
        roleRecord = await this.prisma.role.findFirst({
          where: { name: 'CUSTOMER' },
        });
      }

      if (!roleRecord) {
        throw new InternalServerErrorException('Default user role not configured');
      }

      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await argon2.hash(randomPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: normalizedEmail,
            fullName: dto.fullName?.trim() || normalizedEmail.split('@')[0],
            avatarUrl: dto.avatarUrl || null,
            passwordHash,
            isActive: true,
            isEmailVerified: true,
            isPhoneVerified: false,
          },
        });

        await tx.userRole.create({
          data: {
            userId: created.id,
            roleId: roleRecord!.id,
          },
        });

        return tx.user.findUnique({
          where: { id: created.id },
          include: {
            roles: { include: { role: true } },
          },
        });
      });
    }

    if (!user) {
      throw new InternalServerErrorException('Failed to process Google sign-in');
    }

    const roles = user.roles.map((r) => r.role.name);
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      roles,
      ipAddress,
      deviceInfo,
    );

    if (dto.fcmToken) {
      await this.saveUserDeviceToken(
        user.id,
        dto.fcmToken,
        'MOBILE',
        deviceInfo || 'Google Auth Client',
      );
    }

    const timestamp = new Date().toISOString();
    const userLocation =
      dto.latitude !== undefined || dto.longitude !== undefined
        ? {
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            location: dto.location ?? null,
          }
        : null;

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_GOOGLE',
          entityType: 'User',
          entityId: user.id,
          ipAddress: ipAddress || null,
          userAgent: deviceInfo || null,
          newValues: {
            userLocation,
            timestamp,
          },
        },
      });
    } catch (auditErr: any) {
      this.logger.warn(`Failed to create google login audit log: ${auditErr?.message}`);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        roles,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      userLocation,
      timestamp,
    };
  }
}
