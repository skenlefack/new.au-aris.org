// React Query hooks for the Slideshow module.
//
// Wraps the analytics service (services/analytics, port 3030) endpoints
// for slideshow CRUD, slide management, public tokens.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { analyticsClient } from './client';

// ─── Types ──────────────────────────────────────────────────────

export interface SlideshowSlide {
  id: string;
  dashboardId: string;
  sortOrder: number;
  durationMs?: number | null;
  transition?: string | null;
  dashboardTitleFr?: string;
  dashboardTitleEn?: string;
  dashboard?: any;
}

export interface Slideshow {
  id: string;
  tenantId: string;
  titleFr: string;
  titleEn: string;
  titleAr?: string | null;
  titlePt?: string | null;
  description?: string | null;
  publicToken: string;
  isActive: boolean;
  transition: string;
  intervalMs: number;
  autoPlay: boolean;
  loop: boolean;
  showProgress: boolean;
  showControls: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  slides: SlideshowSlide[];
}

// ─── Hooks ──────────────────────────────────────────────────────

export function useSlideshows(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['slideshows', page, limit],
    queryFn: async () => {
      const res = await analyticsClient.get('/slideshows', { params: { page, limit } });
      return res.data;
    },
  });
}

export function useSlideshow(id: string | undefined) {
  return useQuery({
    queryKey: ['slideshow', id],
    queryFn: async () => {
      const res = await analyticsClient.get(`/slideshows/${id}`);
      return res.data?.data as Slideshow;
    },
    enabled: !!id,
  });
}

export function usePublicSlideshow(token: string | undefined) {
  return useQuery({
    queryKey: ['slideshow-public', token],
    queryFn: async () => {
      const res = await analyticsClient.get(`/slideshows/public/${token}`);
      return res.data?.data as Slideshow;
    },
    enabled: !!token,
  });
}

export function usePublicSlideshowRender(token: string | undefined) {
  return useQuery({
    queryKey: ['slideshow-public-render', token],
    queryFn: async () => {
      const res = await analyticsClient.get(`/slideshows/public/${token}/render`);
      return res.data?.data;
    },
    enabled: !!token,
    refetchInterval: 5 * 60 * 1000, // refresh data every 5 min
  });
}

export function useCreateSlideshow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await analyticsClient.post('/slideshows', data);
      return res.data?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slideshows'] }),
  });
}

export function useUpdateSlideshow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await analyticsClient.patch(`/slideshows/${id}`, data);
      return res.data?.data;
    },
    onSuccess: (_d: any, vars: any) => {
      qc.invalidateQueries({ queryKey: ['slideshows'] });
      qc.invalidateQueries({ queryKey: ['slideshow', vars.id] });
    },
  });
}

export function useDeleteSlideshow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await analyticsClient.delete(`/slideshows/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slideshows'] }),
  });
}

export function useUpdateSlides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, slides }: { id: string; slides: any[] }) => {
      const res = await analyticsClient.put(`/slideshows/${id}/slides`, { slides });
      return res.data?.data;
    },
    onSuccess: (_d: any, vars: any) => {
      qc.invalidateQueries({ queryKey: ['slideshow', vars.id] });
      qc.invalidateQueries({ queryKey: ['slideshows'] });
    },
  });
}

export function useRegenerateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await analyticsClient.post(`/slideshows/${id}/regenerate-token`);
      return res.data?.data;
    },
    onSuccess: (_d: any, id: string) => {
      qc.invalidateQueries({ queryKey: ['slideshow', id] });
    },
  });
}
