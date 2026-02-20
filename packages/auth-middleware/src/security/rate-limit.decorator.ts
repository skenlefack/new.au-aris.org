import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'ARIS_RATE_LIMIT';

export interface RateLimitOptions {
  max?: number;
  windowMs?: number;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
