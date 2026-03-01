'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { ADMIN_DIVISIONS } from '@/data/admin-divisions';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeoEntity {
  id: string;
  code: string;
  name: Record<string, string>;
  level: string;
  countryCode: string;
  parentId: string | null;
  parentName?: Record<string, string>;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

// ─── Fallback: GADM pre-registered data ──────────────────────────────────────

function buildFallbackGeoEntities(params?: {
  level?: string;
  countryCode?: string;
  parentId?: string;
  search?: string;
  page?: number;
  limit?: number;
}): PaginatedResponse<GeoEntity> {
  const cc = params?.countryCode;
  if (!cc) return { data: [], meta: { total: 0, page: 1, limit: 20 } };

  const div = ADMIN_DIVISIONS[cc];
  if (!div) return { data: [], meta: { total: 0, page: 1, limit: 20 } };

  const now = new Date().toISOString();
  let entities: GeoEntity[] = [];

  // Build admin1 entities
  if (!params?.level || params.level === 'ADMIN1') {
    for (const a of div.admin1) {
      entities.push({
        id: a.gid,
        code: a.code,
        name: { en: a.name, fr: a.name, pt: a.name, ar: a.name },
        level: 'ADMIN1',
        countryCode: cc,
        parentId: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Build admin2 entities
  if (!params?.level || params.level === 'ADMIN2') {
    for (const a of div.admin2) {
      // Find parent admin1
      const parentA1 = div.admin1.find((p) => p.gid === a.parentGid);
      entities.push({
        id: a.gid,
        code: a.code,
        name: { en: a.name, fr: a.name, pt: a.name, ar: a.name },
        level: 'ADMIN2',
        countryCode: cc,
        parentId: a.parentGid,
        parentName: parentA1
          ? { en: parentA1.name, fr: parentA1.name, pt: parentA1.name, ar: parentA1.name }
          : { en: a.parentName, fr: a.parentName, pt: a.parentName, ar: a.parentName },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Filter by parentId
  if (params?.parentId) {
    entities = entities.filter((e) => e.parentId === params.parentId);
  }

  // Filter by search
  if (params?.search) {
    const q = params.search.toLowerCase();
    entities = entities.filter(
      (e) =>
        e.name.en.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q),
    );
  }

  // Sort by name
  entities.sort((a, b) => a.name.en.localeCompare(b.name.en));

  // Paginate
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const total = entities.length;
  const start = (page - 1) * limit;
  const sliced = entities.slice(start, start + limit);

  return { data: sliced, meta: { total, page, limit } };
}

function buildFallbackChildren(
  parentId: string,
  params?: { search?: string; page?: number; limit?: number },
): PaginatedResponse<GeoEntity> {
  // Search all countries for a matching parent
  const now = new Date().toISOString();
  let entities: GeoEntity[] = [];

  for (const [cc, div] of Object.entries(ADMIN_DIVISIONS)) {
    // Check if parentId is an admin1 GID
    const parentA1 = div.admin1.find((a) => a.gid === parentId);
    if (parentA1) {
      const children = div.admin2.filter((a) => a.parentGid === parentId);
      for (const a of children) {
        entities.push({
          id: a.gid,
          code: a.code,
          name: { en: a.name, fr: a.name, pt: a.name, ar: a.name },
          level: 'ADMIN2',
          countryCode: cc,
          parentId,
          parentName: { en: parentA1.name, fr: parentA1.name, pt: parentA1.name, ar: parentA1.name },
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      break;
    }
  }

  // Search filter
  if (params?.search) {
    const q = params.search.toLowerCase();
    entities = entities.filter(
      (e) => e.name.en.toLowerCase().includes(q) || e.code.toLowerCase().includes(q),
    );
  }

  entities.sort((a, b) => a.name.en.localeCompare(b.name.en));

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const total = entities.length;
  const start = (page - 1) * limit;

  return { data: entities.slice(start, start + limit), meta: { total, page, limit } };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useGeoEntities(params?: {
  level?: string;
  countryCode?: string;
  parentId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.level) searchParams.level = params.level;
  if (params?.countryCode) searchParams.countryCode = params.countryCode;
  if (params?.parentId) searchParams.parentId = params.parentId;
  if (params?.search) searchParams.search = params.search;
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.sort) searchParams.sort = params.sort;
  if (params?.order) searchParams.order = params.order;

  return useQuery({
    queryKey: ['geo', 'entities', params],
    queryFn: async () => {
      let apiResult: PaginatedResponse<GeoEntity> | null = null;
      try {
        apiResult = await apiClient.get<PaginatedResponse<GeoEntity>>(
          '/master-data/geo',
          searchParams,
        );
      } catch {
        // API failed — will use GADM fallback below
      }
      // Use API data if non-empty
      if (apiResult?.data && apiResult.data.length > 0) return apiResult;
      // Otherwise use GADM pre-registered data
      return buildFallbackGeoEntities(params);
    },
    staleTime: 5 * 60_000,
  });
}

export function useGeoChildren(
  parentId: string | undefined | null,
  params?: { search?: string; page?: number; limit?: number },
) {
  const searchParams: Record<string, string> = {};
  if (params?.search) searchParams.search = params.search;
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);

  return useQuery({
    queryKey: ['geo', 'children', parentId, params],
    queryFn: async () => {
      try {
        return await apiClient.get<PaginatedResponse<GeoEntity>>(
          `/master-data/geo/${parentId}/children`,
          searchParams,
        );
      } catch {
        // Fallback
        return buildFallbackChildren(parentId!, params);
      }
    },
    enabled: !!parentId,
    staleTime: 5 * 60_000,
  });
}

export function useGeoEntity(id: string | undefined | null) {
  return useQuery({
    queryKey: ['geo', 'entity', id],
    queryFn: async () => {
      try {
        return await apiClient.get<{ data: GeoEntity }>(`/master-data/geo/${id}`);
      } catch {
        // Search in GADM data
        for (const [cc, div] of Object.entries(ADMIN_DIVISIONS)) {
          const now = new Date().toISOString();
          const a1 = div.admin1.find((a) => a.gid === id);
          if (a1) {
            return {
              data: {
                id: a1.gid,
                code: a1.code,
                name: { en: a1.name, fr: a1.name, pt: a1.name, ar: a1.name },
                level: 'ADMIN1',
                countryCode: cc,
                parentId: null,
                isActive: true,
                createdAt: now,
                updatedAt: now,
              } as GeoEntity,
            };
          }
          const a2 = div.admin2.find((a) => a.gid === id);
          if (a2) {
            const parent = div.admin1.find((p) => p.gid === a2.parentGid);
            return {
              data: {
                id: a2.gid,
                code: a2.code,
                name: { en: a2.name, fr: a2.name, pt: a2.name, ar: a2.name },
                level: 'ADMIN2',
                countryCode: cc,
                parentId: a2.parentGid,
                parentName: parent
                  ? { en: parent.name, fr: parent.name, pt: parent.name, ar: parent.name }
                  : { en: a2.parentName, fr: a2.parentName, pt: a2.parentName, ar: a2.parentName },
                isActive: true,
                createdAt: now,
                updatedAt: now,
              } as GeoEntity,
            };
          }
        }
        return { data: null as unknown as GeoEntity };
      }
    },
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useCreateGeoEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      code: string;
      name: Record<string, string>;
      level: string;
      countryCode: string;
      parentId?: string;
      latitude?: number;
      longitude?: number;
    }) => apiClient.post<{ data: GeoEntity }>('/master-data/geo', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geo'] });
    },
  });
}

export function useUpdateGeoEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      code?: string;
      name?: Record<string, string>;
      parentId?: string;
      latitude?: number;
      longitude?: number;
      isActive?: boolean;
    }) => apiClient.patch<{ data: GeoEntity }>(`/master-data/geo/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geo'] });
    },
  });
}
