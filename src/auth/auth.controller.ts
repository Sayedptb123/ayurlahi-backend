import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterOrganisationDto } from './dto/register-organisation.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestRegistrationOtpDto } from './dto/request-registration-otp.dto';
import { VerifyRegistrationOtpDto } from './dto/verify-registration-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      return await this.authService.login(loginDto);
    } catch (error) {
      console.error('[Auth Controller] Login error:', {
        error: error.message,
        stack: error.stack,
        email: loginDto.email,
      });
      throw error;
    }
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('register-organisation')
  async registerOrganisation(@Body() dto: RegisterOrganisationDto) {
    return this.authService.registerOrganisation(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    console.log('[Auth Controller] GET /me - Request received:', {
      hasUser: !!req.user,
      userId: req.user?.userId,
      email: req.user?.email,
      organisationId: req.user?.organisationId,
      role: req.user?.role,
    });
    return this.authService.getCurrentUser(
      req.user.userId,
      req.user.organisationId,
    );
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Request() req, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(req.user.userId, dto);
  }

  @Post('switch-organisation')
  @UseGuards(JwtAuthGuard)
  async switchOrganisation(
    @Body('organisationId') organisationId: string,
    @Request() req,
  ) {
    return this.authService.switchOrganisation(req.user.userId, organisationId);
  }

  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    console.log('[Auth Controller] POST /refresh - Request received:', {
      hasRefreshToken: !!refreshTokenDto.refreshToken,
      refreshTokenLength: refreshTokenDto.refreshToken?.length,
      refreshTokenPreview: refreshTokenDto.refreshToken
        ? refreshTokenDto.refreshToken.substring(0, 30) + '...'
        : 'missing',
    });
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }
  @Post('logout')
  async logout(@Request() req) {
    return { message: 'Logged out successfully' };
  }

  @Post('request-otp')
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtpLogin(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // Phone-first registration: step 1 — send OTP to the phone number the user
  // is registering with. No login / no user-exists requirement.
  @Post('request-registration-otp')
  async requestRegistrationOtp(@Body() dto: RequestRegistrationOtpDto) {
    return this.authService.requestRegistrationOtp(dto);
  }

  // Step 2 — verify the OTP. Returns a short-lived JWT that the registration
  // form submits alongside the rest of the org details.
  @Post('verify-registration-otp')
  async verifyRegistrationOtp(@Body() dto: VerifyRegistrationOtpDto) {
    return this.authService.verifyRegistrationOtp(dto);
  }
}
