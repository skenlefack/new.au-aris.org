import type Redis from 'ioredis';

export interface GeoResult {
  country: string;
  countryCode: string;
  city: string;
  latitude: number;
  longitude: number;
}

const CACHE_TTL = 86400; // 24 hours
const PRIVATE_IP = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|0\.0\.0\.0|unknown|localhost)/;

export class GeolocationService {
  private geoLookup: ((ip: string) => any) | null = null;
  private loaded = false;

  constructor(private readonly redis: Redis) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      // Dynamic import — geoip-lite may not be available in all environments
      const geoip = await (Function('return import("geoip-lite")')() as Promise<any>);
      this.geoLookup = (geoip.default?.lookup ?? geoip.lookup) as (ip: string) => any;
    } catch {
      this.geoLookup = null;
    }
    this.loaded = true;
  }

  async lookup(ip: string): Promise<GeoResult | null> {
    if (!ip || PRIVATE_IP.test(ip)) return null;

    // Check cache
    try {
      const cached = await this.redis.get(`geo:${ip}`);
      if (cached) return JSON.parse(cached);
      if (cached === '') return null; // negative cache
    } catch { /* ignore */ }

    await this.ensureLoaded();
    if (!this.geoLookup) return null;

    try {
      const data = this.geoLookup(ip);
      if (!data) {
        // Negative cache (avoid repeated lookups for unresolvable IPs)
        try { await this.redis.set(`geo:${ip}`, '', 'EX', CACHE_TTL); } catch { /* ignore */ }
        return null;
      }
      const result: GeoResult = {
        country: data.country || 'Unknown',
        countryCode: (data.country || '') as string,
        city: data.city || '',
        latitude: data.ll?.[0] ?? 0,
        longitude: data.ll?.[1] ?? 0,
      };
      try { await this.redis.set(`geo:${ip}`, JSON.stringify(result), 'EX', CACHE_TTL); } catch { /* ignore */ }
      return result;
    } catch {
      return null;
    }
  }
}
