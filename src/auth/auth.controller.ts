import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    console.log('[Auth Controller] GET /me - Request received:', {
      hasUser: !!req.user,
      userId: req.user?.userId,
      email: req.user?.email,
      role: req.user?.role,
      headers: {
        authorization: req.headers?.authorization ? req.headers.authorization.substring(0, 30) + '...' : 'missing',
      },
    });
    return this.authService.getCurrentUser(req.user.userId);
  }

  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    console.log('[Auth Controller] POST /refresh - Request received:', {
      hasRefreshToken: !!refreshTokenDto.refreshToken,
      refreshTokenLength: refreshTokenDto.refreshToken?.length,
      refreshTokenPreview: refreshTokenDto.refreshToken ? refreshTokenDto.refreshToken.substring(0, 30) + '...' : 'missing',
    });
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }
}




