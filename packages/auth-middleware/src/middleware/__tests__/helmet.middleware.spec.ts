import { describe, it, expect, vi } from 'vitest';
import { HelmetMiddleware } from '../helmet.middleware';

describe('HelmetMiddleware', () => {
  it('should call next() and set security headers', () => {
    const middleware = new HelmetMiddleware();
    const headers: Record<string, string> = {};

    const req = {
      method: 'GET',
      url: '/',
      headers: {},
    };

    const res = {
      setHeader: vi.fn((name: string, value: string) => {
        headers[name.toLowerCase()] = value;
        return res;
      }),
      getHeader: vi.fn(),
      removeHeader: vi.fn(),
    };

    const next = vi.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    // Helmet should have called setHeader at least once for security headers
    expect(res.setHeader).toHaveBeenCalled();
  });
});
