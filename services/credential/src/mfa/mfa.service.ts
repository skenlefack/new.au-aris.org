import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma.service';

const ISSUER = 'ARIS';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async setup(userId: string): Promise<{ qrCodeUrl: string; secret: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const totp = new OTPAuth.TOTP({
      issuer: ISSUER,
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const secret = totp.secret.base32;

    // Store secret in DB (not yet enabled)
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    const uri = totp.toString();
    const qrCodeUrl = await QRCode.toDataURL(uri);

    this.logger.log(`MFA setup initiated for user ${userId}`);
    return { qrCodeUrl, secret };
  }

  async verify(
    userId: string,
    code: string,
  ): Promise<{ verified: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA not configured. Call setup first.');
    }

    const isValid = MfaService.validateCode(user.mfaSecret, code, user.email);
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    // Enable MFA on first successful verification
    if (!user.mfaEnabled) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      });
      this.logger.log(`MFA enabled for user ${userId}`);
    }

    return { verified: true };
  }

  async disable(
    userId: string,
    code: string,
  ): Promise<{ disabled: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled');
    }

    const isValid = MfaService.validateCode(user.mfaSecret, code, user.email);
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    this.logger.log(`MFA disabled for user ${userId}`);
    return { disabled: true };
  }

  /**
   * Pure validation of a TOTP code against a secret.
   * Used by login flow and verify/disable endpoints.
   */
  static validateCode(
    secret: string,
    code: string,
    email: string,
  ): boolean {
    const totp = new OTPAuth.TOTP({
      issuer: ISSUER,
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  }
}
