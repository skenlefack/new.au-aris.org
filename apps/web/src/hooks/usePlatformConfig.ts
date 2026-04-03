'use client';

import { useQuery } from '@tanstack/react-query';
import { useSettingsConfig } from '@/lib/api/settings-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';

const TENANT_API = process.env['NEXT_PUBLIC_TENANT_API_URL'] ?? '';

function resolveFullName(raw: unknown, locale: string): string {
  const fallback = 'Animal Resources Information System';
  if (!raw) return fallback;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, string>;
    return obj[locale] || obj['en'] || fallback;
  }
  return fallback;
}

/** For authenticated pages (dashboard, settings) — uses the auth-protected settings API. */
export function usePlatformConfig() {
  const locale = useLocaleStore((s) => s.locale);
  const { data } = useSettingsConfig('general');
  const configs: any[] = data?.data ?? [];
  const get = (key: string) => configs.find((c: any) => c.key === key)?.value;

  const fullNameRaw = get('platform.fullName');

  return {
    name: (get('platform.name') as string) || 'ARIS',
    fullName: resolveFullName(fullNameRaw, locale),
    logoUrl: (get('platform.logo.url') as string) || '/au-logo.png',
  };
}

/** For public pages (login, landing) — no auth required, falls back to defaults. */
async function fetchPublicPlatformConfig(): Promise<{ data: any[] } | null> {
  try {
    const res = await fetch(`${TENANT_API}/api/v1/settings/config/general`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function usePublicPlatformConfig() {
  const locale = useLocaleStore((s) => s.locale);

  const { data } = useQuery({
    queryKey: ['public', 'platform-config'],
    queryFn: fetchPublicPlatformConfig,
    staleTime: 10 * 60_000,
    placeholderData: null,
  });

  const configs: any[] = data?.data ?? [];
  const get = (key: string) => configs.find((c: any) => c.key === key)?.value;

  return {
    name: (get('platform.name') as string) || 'ARIS',
    fullName: resolveFullName(get('platform.fullName'), locale),
    logoUrl: (get('platform.logo.url') as string) || '/au-logo.png',
  };
}
