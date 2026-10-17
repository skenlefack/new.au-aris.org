'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy /interop page — redirects to /interop-hub (Hub v3).
 */
export default function InteropRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/interop-hub');
  }, [router]);
  return null;
}
