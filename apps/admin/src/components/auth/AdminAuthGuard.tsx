'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Shield } from 'lucide-react';

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, accessToken, user } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (!isAuthenticated || !accessToken) {
      router.replace('/login');
      return;
    }

    if (
      user?.role !== 'SUPER_ADMIN' &&
      user?.role !== 'CONTINENTAL_ADMIN'
    ) {
      router.replace('/login');
    }
  }, [hydrated, isAuthenticated, accessToken, user, router]);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-admin-bg">
        <div className="flex flex-col items-center gap-3">
          <Shield className="w-8 h-8 text-primary-500 animate-pulse" />
          <p className="text-admin-muted text-sm">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !accessToken) {
    return null;
  }

  return <>{children}</>;
}
