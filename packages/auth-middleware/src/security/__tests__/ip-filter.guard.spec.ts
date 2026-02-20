import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { IpFilterGuard } from '../ip-filter.guard';
import type { AuthModuleOptions } from '../../interfaces/jwt-payload.interface';

function mockContext(ip = '127.0.0.1') {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip,
        headers: {},
        connection: { remoteAddress: ip },
      }),
    }),
  } as unknown as import('@nestjs/common').ExecutionContext;
}

describe('IpFilterGuard', () => {
  it('should pass all IPs when no filter is configured', () => {
    const guard = new IpFilterGuard({ publicKey: 'test' });
    expect(guard.canActivate(mockContext('1.2.3.4'))).toBe(true);
  });

  it('should pass all IPs when whitelist and blacklist are empty', () => {
    const options: AuthModuleOptions = {
      publicKey: 'test',
      security: { ipFilter: { whitelist: [], blacklist: [] } },
    };
    const guard = new IpFilterGuard(options);
    expect(guard.canActivate(mockContext('1.2.3.4'))).toBe(true);
  });

  it('should block blacklisted IPs with 403', () => {
    const options: AuthModuleOptions = {
      publicKey: 'test',
      security: { ipFilter: { blacklist: ['10.0.0.1'] } },
    };
    const guard = new IpFilterGuard(options);
    expect(() => guard.canActivate(mockContext('10.0.0.1'))).toThrow(
      ForbiddenException,
    );
  });

  it('should allow non-blacklisted IPs', () => {
    const options: AuthModuleOptions = {
      publicKey: 'test',
      security: { ipFilter: { blacklist: ['10.0.0.1'] } },
    };
    const guard = new IpFilterGuard(options);
    expect(guard.canActivate(mockContext('192.168.1.1'))).toBe(true);
  });

  it('should only allow whitelisted IPs when whitelist is non-empty', () => {
    const options: AuthModuleOptions = {
      publicKey: 'test',
      security: { ipFilter: { whitelist: ['10.0.0.1', '10.0.0.2'] } },
    };
    const guard = new IpFilterGuard(options);
    expect(guard.canActivate(mockContext('10.0.0.1'))).toBe(true);
    expect(guard.canActivate(mockContext('10.0.0.2'))).toBe(true);
    expect(() => guard.canActivate(mockContext('192.168.1.1'))).toThrow(
      ForbiddenException,
    );
  });

  it('should check blacklist before whitelist', () => {
    const options: AuthModuleOptions = {
      publicKey: 'test',
      security: {
        ipFilter: {
          whitelist: ['10.0.0.1'],
          blacklist: ['10.0.0.1'],
        },
      },
    };
    const guard = new IpFilterGuard(options);
    // Blacklisted takes precedence
    expect(() => guard.canActivate(mockContext('10.0.0.1'))).toThrow(
      ForbiddenException,
    );
  });
});
