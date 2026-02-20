'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ToastContainer } from '@/components/realtime/ToastContainer';
import { useRealtime } from '@/lib/realtime/use-realtime';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Connect to WebSocket realtime service
  useRealtime();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="px-6 py-4">
            <Breadcrumbs />
          </div>
          <div className="px-6 pb-8">{children}</div>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
