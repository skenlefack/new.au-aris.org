import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheInvalidationService } from '../cache-invalidation.service';
import { CacheService } from '../cache.service';
import type { CacheInvalidationRule } from '../cache.types';

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let cacheService: {
    invalidateEntity: ReturnType<typeof vi.fn>;
    invalidateByPattern: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    cacheService = {
      invalidateEntity: vi.fn().mockResolvedValue(true),
      invalidateByPattern: vi.fn().mockResolvedValue(3),
    };
    service = new CacheInvalidationService(cacheService as unknown as CacheService);
  });

  describe('registerRules', () => {
    it('should register rules and expose registered topics', () => {
      const rules: CacheInvalidationRule[] = [
        { topic: 'ms.health.outbreak.created.v1', domain: 'health', entity: 'outbreak' },
        { topic: 'sys.master.species.updated.v1', domain: 'master', entity: 'species' },
      ];

      service.registerRules(rules);

      expect(service.getRegisteredTopics()).toEqual([
        'ms.health.outbreak.created.v1',
        'sys.master.species.updated.v1',
      ]);
    });

    it('should allow multiple rules on the same topic', () => {
      service.registerRules([
        { topic: 'ms.health.outbreak.created.v1', domain: 'health', entity: 'outbreak' },
        { topic: 'ms.health.outbreak.created.v1', domain: 'health', entity: 'dashboard' },
      ]);

      expect(service.getRegisteredTopics()).toHaveLength(1);
    });
  });

  describe('handleEvent', () => {
    it('should invalidate specific entity when extractId is provided', async () => {
      service.registerRules([
        {
          topic: 'ms.health.outbreak.updated.v1',
          domain: 'health',
          entity: 'outbreak',
          extractId: (payload) => payload['id'] as string,
        },
      ]);

      const count = await service.handleEvent('ms.health.outbreak.updated.v1', { id: 'abc-123' });

      expect(cacheService.invalidateEntity).toHaveBeenCalledWith('health', 'outbreak', 'abc-123');
      expect(cacheService.invalidateByPattern).toHaveBeenCalledWith('health', 'outbreak:list');
      expect(count).toBeGreaterThan(0);
    });

    it('should invalidate entire entity pattern when no extractId', async () => {
      service.registerRules([
        {
          topic: 'sys.master.species.updated.v1',
          domain: 'master',
          entity: 'species',
        },
      ]);

      const count = await service.handleEvent('sys.master.species.updated.v1', {});

      expect(cacheService.invalidateByPattern).toHaveBeenCalledWith('master', 'species');
      expect(count).toBe(3);
    });

    it('should return 0 for unregistered topics', async () => {
      const count = await service.handleEvent('unknown.topic.v1', {});

      expect(count).toBe(0);
      expect(cacheService.invalidateEntity).not.toHaveBeenCalled();
    });

    it('should handle extractId returning null gracefully', async () => {
      service.registerRules([
        {
          topic: 'ms.health.outbreak.updated.v1',
          domain: 'health',
          entity: 'outbreak',
          extractId: () => null,
        },
      ]);

      const count = await service.handleEvent('ms.health.outbreak.updated.v1', {});

      expect(cacheService.invalidateEntity).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });

    it('should handle errors in invalidation without throwing', async () => {
      cacheService.invalidateByPattern.mockRejectedValueOnce(new Error('Redis connection lost'));

      service.registerRules([
        { topic: 'sys.master.species.updated.v1', domain: 'master', entity: 'species' },
      ]);

      const count = await service.handleEvent('sys.master.species.updated.v1', {});

      expect(count).toBe(0); // Error swallowed, logged
    });
  });
});
