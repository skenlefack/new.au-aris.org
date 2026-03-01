'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ToastContainer } from '@/components/realtime/ToastContainer';
import { RouteChangeLoader } from '@/components/ui/PageLoader';
import { AuthGuard } from '@/components/auth/AuthGuard';
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

  // Apply dynamic entity accent color
  useEntityTheme();

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
      </div>
    </AuthGuard>
  );
}
