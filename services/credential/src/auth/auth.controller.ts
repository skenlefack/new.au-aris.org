import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import {
  AuthGuard,
  RolesGuard,
  Roles,
  CurrentUser,
  RateLimitGuard,
  RateLimit,
} from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import { AuthService } from './auth.service';
import type { TokenResponse, MfaRequiredResponse, SafeUser } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('api/v1/auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
  )
  async register(
    @Body() dto: RegisterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: SafeUser }> {
    return this.authService.register(dto, user);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ max: 10, windowMs: 60_000 })
  async login(
    @Body() dto: LoginDto,
  ): Promise<{ data: TokenResponse | MfaRequiredResponse }> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ max: 10, windowMs: 60_000 })
  async refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<{ data: TokenResponse }> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('authorization') authHeader?: string,
  ): Promise<{ data: { message: string } }> {
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    return this.authService.logout(user.userId, accessToken);
  }
}
