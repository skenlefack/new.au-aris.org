'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ToastContainer } from '@/components/realtime/ToastContainer';
import { RouteChangeLoader, PageReadyProvider } from '@/components/ui/PageLoader';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ForcePasswordChangeModal } from '@/components/auth/ForcePasswordChangeModal';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useDomainStore } from '@/lib/stores/domain-store';
import { useI18nOverridesStore } from '@/lib/stores/i18n-overrides-store';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { usePublicDomains, useSettingsConfig, usePublicLocales } from '@/lib/api/settings-hooks';
import { LOCALES, type Locale } from '@/lib/i18n/config';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { useEntityTheme } from '@/hooks/useEntityTheme';
import { Menu } from 'lucide-react';

const SIDEBAR_STORAGE_KEY = 'aris-sidebar-collapsed';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Embed mode — hide sidebar/header for iframe embedding (slideshow)
  const [isEmbed] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === '1'
  );

  // Viewer token injection for public slideshow embeds.
  // When an iframe loads ?embed=1&viewerToken=xxx we must inject the token
  // into BOTH localStorage (so Zustand persist hydration finds it) AND the
  // in-memory Zustand state (so immediate API calls have the token).
  // This runs synchronously during initial render, before any child mounts.
  const [viewerInjected] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const viewerToken = params.get('viewerToken');
    const embed = params.get('embed');
    if (embed !== '1' || !viewerToken) return false;
    try {
      const payload = JSON.parse(atob(viewerToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const user = {
        id: payload.sub ?? 'viewer',
        email: payload.email ?? 'viewer@au-aris.org',
        firstName: 'Slideshow',
        lastName: 'Viewer',
        role: payload.role ?? 'ANALYST',
        roles: payload.roles ?? [payload.role ?? 'ANALYST'],
        tenantId: payload.tenantId ?? '',
        tenantLevel: payload.tenantLevel ?? 'CONTINENTAL',
      };
      // Write to localStorage FIRST — Zustand persist hydration reads from here.
      // Without this, persist overwrites the in-memory state with the old (empty) localStorage.
      localStorage.setItem('aris-auth', JSON.stringify({
        state: { user, accessToken: viewerToken, refreshToken: '', isAuthenticated: true },
        version: 0,
      }));
      // Also set in-memory Zustand state for immediate use
      useAuthStore.getState().setAuth(user as any, viewerToken, '');
      return true;
    } catch { return false; }
  });

  // Full-bleed pages (no padding wrapper) — dashboard handles its own layout
  const isFullBleed = isEmbed || pathname === '/home' || pathname === '/' || pathname.startsWith('/bi-tools/');

  // Connect to WebSocket realtime service (skip in embed mode — viewer doesn't need realtime)
  useRealtime(!isEmbed);

  // Auto-detect browser language if i18n.autoDetect is enabled
  const { data: i18nConfig } = usePublicLocales();
  const setLocale = useLocaleStore((s) => s.setLocale);
  const _hasHydrated = useLocaleStore((s) => s._hasHydrated);
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!i18nConfig?.data?.autoDetect) return;
    if (typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem('aris-locale-autodetected')) return;
    sessionStorage.setItem('aris-locale-autodetected', '1');
    const browserLang = navigator.language.split('-')[0].toLowerCase();
    const available = (i18nConfig?.data?.availableLocales ?? []) as string[];
    if (available.includes(browserLang) && (LOCALES as readonly string[]).includes(browserLang)) {
      setLocale(browserLang as Locale);
    }
  }, [_hasHydrated, i18nConfig, setLocale]);

  // Apply dynamic entity accent color
  useEntityTheme();

  // ── Hooks below are skipped in embed mode (viewer iframes) to avoid unnecessary
  //    API calls that would fail with 401 and pollute the console ──
  const { data: publicDomainData } = usePublicDomains();
  const setAllDomains = useDomainStore((s) => s.setAllDomains);
  const hydrateFromMeAccess = useDomainStore((s) => s.hydrateFromMeAccess);
  const isHydrated = useDomainStore((s) => s.hydrated);
  useEffect(() => {
    if (isEmbed) return;
    const domains = (publicDomainData as any)?.data;
    if (Array.isArray(domains) && domains.length > 0) {
      setAllDomains(domains);
    }
  }, [isEmbed, publicDomainData, setAllDomains]);

  useEffect(() => {
    if (isEmbed || isHydrated) return;
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    fetch('/api/v1/credential/me/access', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.domains) {
          hydrateFromMeAccess({
            domains: data.domains,
            subDomainsDetails: data.subDomainsDetails ?? [],
            valueChainCodes: data.valueChainCodes ?? [],
          });
        }
      })
      .catch(() => { /* non-blocking */ });
  }, [isEmbed, isHydrated, hydrateFromMeAccess]);

  const { data: i18nOverridesData } = useSettingsConfig('i18n-overrides');
  const setI18nOverrides = useI18nOverridesStore((s) => s.setOverrides);
  useEffect(() => {
    if (isEmbed) return;
    const configs = (i18nOverridesData as any)?.data;
    if (Array.isArray(configs)) {
      const map: Record<string, Record<string, string>> = {};
      for (const cfg of configs) {
        const k = typeof cfg.key === 'string' ? cfg.key : '';
        if (k && typeof cfg.value === 'object' && cfg.value !== null) {
          map[k] = cfg.value as Record<string, string>;
        }
      }
      setI18nOverrides(map);
    }
  }, [isEmbed, i18nOverridesData, setI18nOverrides]);

  // Persist sidebar state + auto-collapse on tablet
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      setSidebarCollapsed(stored === 'true');
    } else if (window.innerWidth < 1280) {
      setSidebarCollapsed(true);
    }
  }, []);

  const handleToggle = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <AuthGuard>
      {isEmbed ? (
        /* Embed mode: content only, no chrome — used by slideshow iframe */
        <div className="h-screen overflow-y-auto bg-slate-50 dark:bg-gray-950">
          <PageReadyProvider>
            <div className="h-full">{children}</div>
          </PageReadyProvider>
        </div>
      ) : (
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-gray-950">
        <Sidebar
          collapsed={sidebarCollapsed}
          mobileOpen={mobileOpen}
          onMobileClose={handleMobileClose}
        />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Mobile header bar with hamburger */}
          <div className="flex items-center border-b border-gray-200 dark:border-gray-800/80 bg-white dark:bg-gray-900 px-4 py-2 lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex items-center justify-center rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="ml-3 flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/aris-logo.png" alt="ARIS - Animal Resources Information System" className="h-9 object-contain" />
            </div>
          </div>

          <Header
            sidebarCollapsed={sidebarCollapsed}
            onSidebarToggle={handleToggle}
          />

          <main className="relative flex-1 overflow-y-auto bg-slate-50 dark:bg-gray-950">
            <PageReadyProvider>
              <RouteChangeLoader />
              {isFullBleed ? (
                <div className="h-full animate-fade-in">
                  {children}
                </div>
              ) : (
                <div className="px-4 py-5 sm:px-6 pb-8 animate-fade-in">
                  {children}
                </div>
              )}
            </PageReadyProvider>
          </main>
        </div>
        <ToastContainer />
        {/* Blocking modal: shown when the authenticated user has
            mustChangePassword=true. Sits above the ToastContainer and
            locks the app until the password has been updated. */}
        <ForcePasswordChangeModal />
      </div>
      )}
    </AuthGuard>
  );
}
