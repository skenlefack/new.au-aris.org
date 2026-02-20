import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard, CurrentUser } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { MfaService } from './mfa.service';
import { VerifyTotpDto } from './dto/verify-totp.dto';

@Controller('api/v1/auth/mfa')
@UseGuards(AuthGuard)
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('setup')
  async setup(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: { qrCodeUrl: string; secret: string } }> {
    const result = await this.mfaService.setup(user.userId);
    return { data: result };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyTotpDto,
  ): Promise<{ data: { verified: boolean } }> {
    const result = await this.mfaService.verify(user.userId, dto.code);
    return { data: result };
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  async disable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyTotpDto,
  ): Promise<{ data: { disabled: boolean } }> {
    const result = await this.mfaService.disable(user.userId, dto.code);
    return { data: result };
  }
}
