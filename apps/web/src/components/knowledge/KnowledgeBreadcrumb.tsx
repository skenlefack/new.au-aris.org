'use client';

// Shared breadcrumb for the public Knowledge Hub. Renders a clean
// "Home › Section › … › Current" trail with the AU green accent. The last
// item is rendered as plain text (current page). Intermediate items are
// links.

import Link from 'next/link';
import { Home, ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Optional URL — omit for the current page (last item) */
  href?: string;
}

interface Props {
  items: BreadcrumbItem[];
  /** Show the leading home icon link to /knowledge (default true) */
  showHome?: boolean;
  className?: string;
}

export function KnowledgeBreadcrumb({ items, showHome = true, className = '' }: Props) {
  const all: BreadcrumbItem[] = showHome
    ? [{ label: 'Knowledge Hub', href: '/knowledge' }, ...items]
    : items;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 text-xs text-gray-500 ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {all.map((item, i) => {
          const isLast = i === all.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {i === 0 && showHome ? (
                <Link
                  href={item.href ?? '/knowledge'}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-gray-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <Home className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              ) : isLast || !item.href ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="max-w-[28ch] truncate font-medium text-gray-900 dark:text-gray-100"
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="max-w-[24ch] truncate rounded px-1.5 py-0.5 transition hover:bg-emerald-50 hover:text-emerald-700"
                  title={item.label}
                >
                  {item.label}
                </Link>
              )}
              {!isLast && <ChevronRight className="h-3.5 w-3.5 text-gray-300" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
