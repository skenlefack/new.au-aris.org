import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Mock jsonwebtoken
const mockVerify = vi.fn();
vi.mock('jsonwebtoken', () => ({
  default: { verify: (...args: any[]) => mockVerify(...args) },
  verify: (...args: any[]) => mockVerify(...args),
}));

import { authHook } from '../auth.hook';

function makeRequest(headers: Record<string, string> = {}): FastifyRequest {
  return {
    headers,
    log: { warn: vi.fn() },
  } as unknown as FastifyRequest;
}

function makeReply(): FastifyReply {
  const reply = {
    code: vi.fn(),
    send: vi.fn(),
  } as unknown as FastifyReply;
  (reply.code as any).mockReturnValue(reply);
  return reply;
}

describe('authHook', () => {
  const PUBLIC_KEY = 'test-public-key';
  let hook: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    hook = authHook({ publicKey: PUBLIC_KEY });
  });

  it('should return 401 when authorization header is missing', async () => {
    const request = makeRequest({});
    const reply = makeReply();

    await hook(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Missing authorization header' }),
    );
  });

  it('should return 401 when header format is not Bearer <token>', async () => {
    const request = makeRequest({ authorization: 'Basic abc123' });
    const reply = makeReply();

    await hook(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid authorization header format' }),
    );
  });

  it('should set request.user on valid JWT', async () => {
    const jwtPayload = {
      sub: 'user-1',
      email: 'test@example.com',
      role: 'NATIONAL_ADMIN',
      tenantId: 'tenant-ke',
      tenantLevel: 'MEMBER_STATE',
      locale: 'en',
    };
    mockVerify.mockReturnValue(jwtPayload);

    const request = makeRequest({ authorization: 'Bearer valid-token' });
    const reply = makeReply();

    await hook(request, reply);

    expect(mockVerify).toHaveBeenCalledWith('valid-token', PUBLIC_KEY, {
      algorithms: ['RS256'],
    });
    expect(request.user).toEqual({
      userId: 'user-1',
      email: 'test@example.com',
      role: 'NATIONAL_ADMIN',
      tenantId: 'tenant-ke',
      tenantLevel: 'MEMBER_STATE',
      locale: 'en',
    });
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('should return 401 when jwt.verify throws', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const request = makeRequest({ authorization: 'Bearer expired-token' });
    const reply = makeReply();

    await hook(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid or expired token' }),
    );
  });

  it('should return 401 when isTokenBlacklisted returns true', async () => {
    const jwtPayload = {
      sub: 'user-1',
      email: 'test@example.com',
      role: 'ANALYST',
      tenantId: 'tenant-ke',
      tenantLevel: 'MEMBER_STATE',
    };
    mockVerify.mockReturnValue(jwtPayload);

    const isTokenBlacklisted = vi.fn().mockResolvedValue(true);
    const hookWithBlacklist = authHook({ publicKey: PUBLIC_KEY, isTokenBlacklisted });

    const request = makeRequest({ authorization: 'Bearer blacklisted-token' });
    const reply = makeReply();

    await hookWithBlacklist(request, reply);

    expect(isTokenBlacklisted).toHaveBeenCalledWith('blacklisted-token');
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Token has been revoked' }),
    );
  });

  it('should skip blacklist check when isTokenBlacklisted not provided', async () => {
    const jwtPayload = {
      sub: 'user-1',
      email: 'test@example.com',
      role: 'ANALYST',
      tenantId: 'tenant-ke',
      tenantLevel: 'MEMBER_STATE',
    };
    mockVerify.mockReturnValue(jwtPayload);

    const request = makeRequest({ authorization: 'Bearer valid-token' });
    const reply = makeReply();

    await hook(request, reply);

    expect(request.user).toBeDefined();
    expect(reply.code).not.toHaveBeenCalled();
  });
});
