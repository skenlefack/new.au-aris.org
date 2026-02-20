import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as OTPAuth from 'otpauth';
import { MfaService } from '../mfa.service';

function mockPrismaService() {
  return {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

function userFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-001',
    email: 'test@aris.africa',
    mfaEnabled: false,
    mfaSecret: null,
    ...overrides,
  };
}

function generateValidCode(secret: string, email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: 'ARIS',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.generate();
}

describe('MfaService', () => {
  let service: MfaService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(() => {
    prisma = mockPrismaService();
    service = new MfaService(prisma as never);
  });

  describe('setup', () => {
    it('should generate a QR code and secret', async () => {
      prisma.user.findUnique.mockResolvedValue(userFixture());
      prisma.user.update.mockResolvedValue({});

      const result = await service.setup('user-001');

      expect(result.qrCodeUrl).toContain('data:image/png;base64');
      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(0);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { mfaSecret: expect.any(String) },
      });
    });

    it('should reject if MFA is already enabled', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ mfaEnabled: true }),
      );

      await expect(service.setup('user-001')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.setup('missing')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verify', () => {
    it('should accept a valid TOTP code and enable MFA', async () => {
      const secret = new OTPAuth.Secret().base32;
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ mfaSecret: secret }),
      );
      prisma.user.update.mockResolvedValue({});

      const code = generateValidCode(secret, 'test@aris.africa');
      const result = await service.verify('user-001', code);

      expect(result.verified).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { mfaEnabled: true },
      });
    });

    it('should reject an invalid TOTP code', async () => {
      const secret = new OTPAuth.Secret().base32;
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ mfaSecret: secret }),
      );

      await expect(service.verify('user-001', '000000')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject if MFA not configured', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ mfaSecret: null }),
      );

      await expect(service.verify('user-001', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not re-enable if already enabled', async () => {
      const secret = new OTPAuth.Secret().base32;
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ mfaEnabled: true, mfaSecret: secret }),
      );

      const code = generateValidCode(secret, 'test@aris.africa');
      const result = await service.verify('user-001', code);

      expect(result.verified).toBe(true);
      // Should NOT call update to enable MFA again
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('disable', () => {
    it('should disable MFA with valid code', async () => {
      const secret = new OTPAuth.Secret().base32;
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ mfaEnabled: true, mfaSecret: secret }),
      );
      prisma.user.update.mockResolvedValue({});

      const code = generateValidCode(secret, 'test@aris.africa');
      const result = await service.disable('user-001', code);

      expect(result.disabled).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { mfaEnabled: false, mfaSecret: null },
      });
    });

    it('should reject disable with invalid code', async () => {
      const secret = new OTPAuth.Secret().base32;
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ mfaEnabled: true, mfaSecret: secret }),
      );

      await expect(service.disable('user-001', '000000')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject disable if MFA not enabled', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ mfaEnabled: false }),
      );

      await expect(service.disable('user-001', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateCode (static)', () => {
    it('should return true for valid code', () => {
      const secret = new OTPAuth.Secret().base32;
      const code = generateValidCode(secret, 'test@aris.africa');
      expect(
        MfaService.validateCode(secret, code, 'test@aris.africa'),
      ).toBe(true);
    });

    it('should return false for invalid code', () => {
      const secret = new OTPAuth.Secret().base32;
      expect(
        MfaService.validateCode(secret, '000000', 'test@aris.africa'),
      ).toBe(false);
    });
  });
});
