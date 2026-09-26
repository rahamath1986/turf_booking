import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { Role } from '../common/enums/role.enum';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'test@turfbooking.com',
    fullName: 'Test Player',
    phone: '+919999988888',
    passwordHash: '',
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    roles: [{ role: { name: Role.CUSTOMER } }],
  };

  const mockPrismaService: any = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
    userRole: {
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    otpVerification: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userDevice: {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrismaService);
      }
      return Promise.all(callback);
    }),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock_jwt_token_xyz'),
    verify: jest.fn().mockReturnValue({
      sub: 'user-uuid-1',
      email: 'test@turfbooking.com',
      roles: ['CUSTOMER'],
    }),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: any) => {
      if (key === 'jwt.accessSecret')
        return 'test_jwt_access_secret_1234567890';
      if (key === 'jwt.refreshSecret')
        return 'test_jwt_refresh_secret_1234567890';
      if (key === 'jwt.accessExpiration') return '15m';
      if (key === 'jwt.refreshExpiration') return '7d';
      if (key === 'nodeEnv') return 'test';
      return defaultVal;
    }),
  };

  beforeAll(async () => {
    mockUser.passwordHash = await argon2.hash('ValidPassword#123');
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should successfully register a new customer with hashed password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 'role-1',
        name: Role.CUSTOMER,
      });
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (prisma.userRole.create as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.register({
        fullName: 'Test Player',
        email: 'test@turfbooking.com',
        phone: '+919999988888',
        password: 'ValidPassword#123',
        role: Role.CUSTOMER,
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@turfbooking.com');
      expect(result.accessToken).toBe('mock_jwt_token_xyz');
      expect(result.refreshToken).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email is already taken', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.register({
          fullName: 'Duplicate Player',
          email: 'test@turfbooking.com',
          password: 'ValidPassword#123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should successfully authenticate with valid email and password and return accessToken, refreshToken, and timestamp', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.login({
        email: 'test@turfbooking.com',
        password: 'ValidPassword#123',
        fcmToken: 'fcm_sample_token_xyz',
      });

      expect(result.user).toBeDefined();
      expect(result.accessToken).toBe('mock_jwt_token_xyz');
      expect(result.refreshToken).toBe('mock_jwt_token_xyz');
      expect(result.timestamp).toBeDefined();
      expect(mockPrismaService.userDevice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deviceToken: 'fcm_sample_token_xyz' },
        }),
      );
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.login({
          email: 'test@turfbooking.com',
          password: 'WrongPassword#999',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({
          email: 'unknown@turfbooking.com',
          password: 'ValidPassword#123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should capture and return userLocation on login when provided', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'test@turfbooking.com',
        password: 'ValidPassword#123',
        latitude: 12.9716,
        longitude: 77.5946,
      });

      expect(result.userLocation).toEqual({
        latitude: 12.9716,
        longitude: 77.5946,
      });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LOGIN',
            userId: mockUser.id,
            newValues: expect.objectContaining({
              userLocation: {
                latitude: 12.9716,
                longitude: 77.5946,
              },
            }),
          }),
        }),
      );
    });
  });

  describe('logout', () => {
    it('should revoke refreshToken, deactivate fcmToken and return timestamp', async () => {
      const result = await service.logout(
        'user-uuid-1',
        'sample_refresh_token',
        'fcm_token_logout',
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Logged out successfully');
      expect(result.timestamp).toBeDefined();
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalled();
      expect(mockPrismaService.userDevice.updateMany).toHaveBeenCalledWith({
        where: { deviceToken: 'fcm_token_logout' },
        data: { isActive: false },
      });
    });

    it('should record userLocation and audit log on logout when provided', async () => {
      const result = await service.logout(
        'user-uuid-1',
        'sample_refresh_token',
        undefined,
        {
          latitude: 13.0827,
          longitude: 80.2707,
        },
      );

      expect(result.success).toBe(true);
      expect(result.userLocation).toEqual({
        latitude: 13.0827,
        longitude: 80.2707,
      });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LOGOUT',
            userId: 'user-uuid-1',
            newValues: expect.objectContaining({
              userLocation: {
                latitude: 13.0827,
                longitude: 80.2707,
              },
            }),
          }),
        }),
      );
    });
  });

  describe('refreshToken', () => {
    it('should throw UnauthorizedException if refresh token is revoked (reuse detection)', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'token-1',
        userId: 'user-uuid-1',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(service.refreshToken('mock_revoked_token')).rejects.toThrow(
        UnauthorizedException,
      );
      // Ensures all user sessions are invalidated upon reuse
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid-1' },
          data: { isRevoked: true },
        }),
      );
    });
  });
});
