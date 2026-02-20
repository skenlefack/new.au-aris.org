'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const LABELS: Record<string, string> = {
  tenants: 'Tenants',
  users: 'Users',
  'data-contracts': 'Data Contracts',
  audit: 'Audit Log',
  monitoring: 'Monitoring',
  'master-data': 'Master Data',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link
        href="/"
        className="text-admin-muted hover:text-admin-text transition-colors"
      >
        <Home className="w-4 h-4" />
      </Link>

      {segments.map((segment, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        const label = LABELS[segment] ?? segment;

        return (
          <span key={href} className="flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5 text-admin-muted" />
            {isLast ? (
              <span className="text-admin-text font-medium">{label}</span>
            ) : (
              <Link
                href={href}
                className="text-admin-muted hover:text-admin-text transition-colors"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
