import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiClient before importing the module
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
  ApiClientError: class extends Error {},
}));

import { resolveAdminLocationValues } from '@/lib/api/geo-hooks';
import { apiClient } from '@/lib/api/client';

const mockPost = vi.mocked(apiClient.post);

describe('resolveAdminLocationValues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns data unchanged when no admin_location field', async () => {
    const data = { name: 'Test', count: 5 };
    const result = await resolveAdminLocationValues(data);
    expect(result).toEqual(data);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('returns data unchanged when no __new: values', async () => {
    const data = {
      admin_location: { level_0: 'KE', level_1: 'uuid-1', level_2: 'uuid-2' },
    };
    const result = await resolveAdminLocationValues(data);
    expect(result).toEqual(data);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('resolves __new: values by calling ensure API', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'new-uuid-1', code: 'KE_A2_XYZ', name: 'Makueni' } });

    const data = {
      admin_location: {
        level_0: 'KE',
        level_1: 'parent-uuid',
        level_2: '__new:Makueni',
      },
      other_field: 'hello',
    };

    const result = await resolveAdminLocationValues(data);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/master-data/geo/ensure', {
      name: 'Makueni',
      level: 'ADMIN2',
      countryCode: 'KE',
      parentId: 'parent-uuid',
    });

    const resolved = result.admin_location as Record<string, string>;
    expect(resolved.level_0).toBe('KE');
    expect(resolved.level_1).toBe('parent-uuid');
    expect(resolved.level_2).toBe('new-uuid-1');
    expect(result.other_field).toBe('hello');
  });

  it('resolves multiple __new: values in parent→child order', async () => {
    mockPost
      .mockResolvedValueOnce({ data: { id: 'new-uuid-2', code: 'KE_A2_ABC' } })
      .mockResolvedValueOnce({ data: { id: 'new-uuid-3', code: 'KE_A3_DEF' } });

    const data = {
      admin_location: {
        level_0: 'KE',
        level_1: 'parent-uuid',
        level_2: '__new:Makueni',
        level_3: '__new:Kibwezi',
      },
    };

    const result = await resolveAdminLocationValues(data);

    expect(mockPost).toHaveBeenCalledTimes(2);

    // First call: create ADMIN2 with parent=parent-uuid
    expect(mockPost.mock.calls[0][1]).toMatchObject({
      name: 'Makueni',
      level: 'ADMIN2',
      parentId: 'parent-uuid',
    });

    // Second call: create ADMIN3 with parent=new-uuid-2 (the just-created entity)
    expect(mockPost.mock.calls[1][1]).toMatchObject({
      name: 'Kibwezi',
      level: 'ADMIN3',
      parentId: 'new-uuid-2',
    });

    const resolved = result.admin_location as Record<string, string>;
    expect(resolved.level_2).toBe('new-uuid-2');
    expect(resolved.level_3).toBe('new-uuid-3');
  });

  it('keeps __new: value on API failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));

    const data = {
      admin_location: {
        level_0: 'KE',
        level_1: 'parent-uuid',
        level_2: '__new:FailingDistrict',
      },
    };

    const result = await resolveAdminLocationValues(data);

    const resolved = result.admin_location as Record<string, string>;
    // Should keep the __new: prefix on failure
    expect(resolved.level_2).toBe('__new:FailingDistrict');
  });

  it('returns data unchanged when admin_location is null', async () => {
    const data = { admin_location: null, name: 'Test' };
    const result = await resolveAdminLocationValues(data);
    expect(result).toEqual(data);
  });
});
