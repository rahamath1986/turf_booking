import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register a new user account',
    description:
      'Registers a customer or turf owner account with Argon2id password hashing and returns JWT tokens.',
  })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({
    status: 409,
    description: 'Email or phone already registered',
  })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const deviceInfo = req.headers['user-agent'];
    return this.authService.register(dto, ipAddress, deviceInfo);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute - brute-force protection
  @ApiOperation({
    summary: 'Authenticate user with email and password',
    description:
      'Validates credentials and returns JWT access and refresh tokens.',
  })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const deviceInfo = req.headers['user-agent'];
    return this.authService.login(dto, ipAddress, deviceInfo);
  }

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 OTP requests per minute
  @ApiOperation({
    summary: 'Dispatch One-Time Password (OTP)',
    description:
      'Generates and delivers a cryptographically random 6-digit numeric OTP with rate-limiting.',
  })
  @ApiResponse({ status: 200, description: 'OTP dispatched successfully' })
  @ApiResponse({ status: 400, description: 'Rate limit or invalid parameters' })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('resend-otp')
  @ApiOperation({
    summary: 'Resend One-Time Password (OTP)',
    description:
      'Invalidates any previous pending OTP, generates a fresh 6-digit OTP, and returns it in response.',
  })
  @ApiResponse({ status: 200, description: 'OTP resent successfully' })
  async resendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 verification attempts per minute
  @ApiOperation({
    summary: 'Verify One-Time Password (OTP)',
    description:
      'Verifies the OTP code for login, registration, or password reset.',
  })
  @ApiResponse({ status: 200, description: 'OTP verification successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const deviceInfo = req.headers['user-agent'];
    return this.authService.verifyOtp(dto, ipAddress, deviceInfo);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token and issue new access token',
    description:
      'Rotates the refresh token, invalidating the previous token with reuse detection.',
  })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiResponse({
    status: 401,
    description: 'Invalid, revoked, or expired refresh token',
  })
  async refreshToken(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const deviceInfo = req.headers['user-agent'];
    return this.authService.refreshToken(
      dto.refreshToken,
      ipAddress,
      deviceInfo,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke active session tokens',
    description:
      'Invalidates the refresh token and terminates the active session.',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Body() dto: LogoutDto, @Req() req: Request) {
    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    let bearerToken: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7);
      // Optional authenticated logout
      try {
        const payload: any = req.user;
        userId = payload?.userId;
      } catch {
        // Ignored
      }
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.logout(
      userId,
      dto.refreshToken,
      dto.fcmToken,
      {
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
      ipAddress,
      userAgent,
      bearerToken,
    );
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset token',
    description:
      'Generates a secure password reset token without revealing account existence.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset instructions dispatched',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with reset token',
    description:
      'Sets a new account password and invalidates all existing active sessions.',
  })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Change account password',
    description:
      'Verifies current password and updates to a new password for authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Current password incorrect' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Retrieve authenticated user profile',
    description:
      'Returns the current user profile, roles, and device registrations.',
  })
  @ApiResponse({ status: 200, description: 'Current profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser('userId') userId: string) {
    return this.authService.getMe(userId);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate or register user via Google OAuth',
    description:
      'Verifies Google credentials, provisions account if not existing, records location, and returns JWT tokens.',
  })
  @ApiResponse({ status: 200, description: 'User authenticated successfully' })
  async googleLogin(@Body() dto: GoogleLoginDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const deviceInfo = req.headers['user-agent'];
    return this.authService.googleLogin(dto, ipAddress, deviceInfo);
  }
}
