'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ToastContainer } from '@/components/realtime/ToastContainer';
import { RouteChangeLoader } from '@/components/ui/PageLoader';
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

  // Full-bleed pages (no padding wrapper) — dashboard handles its own layout
  const isFullBleed = pathname === '/home' || pathname === '/' || pathname.startsWith('/bi-tools/');

  // Connect to WebSocket realtime service
  useRealtime();

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

  // Sync all domains from public API into domain store (for DomainAutocomplete, DomainSelector, etc.)
  const { data: publicDomainData } = usePublicDomains();
  const setAllDomains = useDomainStore((s) => s.setAllDomains);
  const hydrateFromMeAccess = useDomainStore((s) => s.hydrateFromMeAccess);
  const isHydrated = useDomainStore((s) => s.hydrated);
  useEffect(() => {
    const domains = (publicDomainData as any)?.data;
    if (Array.isArray(domains) && domains.length > 0) {
      setAllDomains(domains);
    }
  }, [publicDomainData, setAllDomains]);

  // Hydrate hierarchical sub-domain permissions from /me/access
  useEffect(() => {
    if (isHydrated) return;
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
  }, [isHydrated, hydrateFromMeAccess]);

  // Load i18n translation overrides from backend (SystemConfig category: i18n-overrides)
  const { data: i18nOverridesData } = useSettingsConfig('i18n-overrides');
  const setI18nOverrides = useI18nOverridesStore((s) => s.setOverrides);
  useEffect(() => {
    const configs = (i18nOverridesData as any)?.data;
    if (Array.isArray(configs)) {
      const map: Record<string, Record<string, string>> = {};
      for (const cfg of configs) {
        // key stored as "namespace.key" (e.g. "settings.translationsTitle")
        const k = typeof cfg.key === 'string' ? cfg.key : '';
        if (k && typeof cfg.value === 'object' && cfg.value !== null) {
          map[k] = cfg.value as Record<string, string>;
        }
      }
      setI18nOverrides(map);
    }
  }, [i18nOverridesData, setI18nOverrides]);

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
            <div className="ml-3 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/au-logo.png" alt="AU-IBAR" className="h-7 w-7 object-contain" />
              <span className="font-bold" style={{ fontSize: '1.2rem', color: '#800020' }}>
                ARIS
              </span>
            </div>
          </div>

          <Header
            sidebarCollapsed={sidebarCollapsed}
            onSidebarToggle={handleToggle}
          />

          <main className="relative flex-1 overflow-y-auto bg-slate-50 dark:bg-gray-950">
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
          </main>
        </div>
        <ToastContainer />
        {/* Blocking modal: shown when the authenticated user has
            mustChangePassword=true. Sits above the ToastContainer and
            locks the app until the password has been updated. */}
        <ForcePasswordChangeModal />
      </div>
    </AuthGuard>
  );
}
