'use client';

import { usePathname } from 'next/navigation';
import { Footer } from '@/components/landing/Footer';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideFooter = pathname.startsWith('/slideshow');

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-900">
      <main className="flex-1">{children}</main>
      {!hideFooter && <Footer />}
    </div>
  );
}
