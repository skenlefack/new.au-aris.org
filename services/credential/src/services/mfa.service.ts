import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import type { PrismaClient } from '@prisma/client';

const ISSUER = 'ARIS';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class MfaService {
  constructor(private readonly prisma: PrismaClient) {}

  async setup(userId: string): Promise<{ qrCodeUrl: string; secret: string }> {
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(400, 'User not found');
    if (user.mfaEnabled) throw new HttpError(400, 'MFA is already enabled');

    const totp = new OTPAuth.TOTP({ issuer: ISSUER, label: user.email, algorithm: 'SHA1', digits: 6, period: 30 });
    const secret = totp.secret.base32;

    await (this.prisma as any).user.update({ where: { id: userId }, data: { mfaSecret: secret } });
    const uri = totp.toString();
    const qrCodeUrl = await QRCode.toDataURL(uri);
    return { qrCodeUrl, secret };
  }

  async verify(userId: string, code: string): Promise<{ verified: boolean }> {
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecret) throw new HttpError(400, 'MFA not configured. Call setup first.');

    const isValid = MfaService.validateCode(user.mfaSecret, code, user.email);
    if (!isValid) throw new HttpError(401, 'Invalid TOTP code');

    if (!user.mfaEnabled) {
      await (this.prisma as any).user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    }
    return { verified: true };
  }

  async disable(userId: string, code: string): Promise<{ disabled: boolean }> {
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecret) throw new HttpError(400, 'MFA is not enabled');

    const isValid = MfaService.validateCode(user.mfaSecret, code, user.email);
    if (!isValid) throw new HttpError(401, 'Invalid TOTP code');

    await (this.prisma as any).user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null } });
    return { disabled: true };
  }

  static validateCode(secret: string, code: string, email: string): boolean {
    const totp = new OTPAuth.TOTP({
      issuer: ISSUER, label: email, algorithm: 'SHA1', digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  }
}
