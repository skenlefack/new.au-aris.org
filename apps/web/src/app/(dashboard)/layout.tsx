'use client';

import React, { useState, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ToastContainer } from '@/components/realtime/ToastContainer';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { Menu } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Connect to WebSocket realtime service
  useRealtime();

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileOpen}
          onMobileClose={handleMobileClose}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile header bar with hamburger */}
          <div className="flex items-center border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex items-center justify-center rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="ml-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-aris-primary-600 text-[10px] font-bold text-white">
                AR
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">ARIS 3.0</span>
            </div>
          </div>
          <Header />
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
            <div className="px-6 py-4">
              <Breadcrumbs />
            </div>
            <div className="px-6 pb-8">{children}</div>
          </main>
        </div>
        <ToastContainer />
      </div>
    </AuthGuard>
  );
}
