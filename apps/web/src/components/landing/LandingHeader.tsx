'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { RecConfig } from '@/data/recs-config';
import type { CountryConfig } from '@/data/countries-config';

interface Crumb {
  label: string;
  href: string;
}

interface LandingHeaderProps {
  rec?: RecConfig;
  country?: CountryConfig;
}

export function LandingHeader({ rec, country }: LandingHeaderProps) {
  const crumbs: Crumb[] = [{ label: 'African Union', href: '/' }];
  if (rec) {
    crumbs.push({ label: rec.name, href: `/rec/${rec.code}` });
  }
  if (country) {
    crumbs.push({ label: country.name, href: `/country/${country.code}` });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/au-logo.png"
              alt="African Union"
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
              priority
            />
            <div className="hidden sm:block">
              <h1 className="font-extrabold leading-tight text-[#800020]" style={{ fontSize: '1.9rem' }}>
                ARIS
              </h1>
              <p className="text-[11px] leading-tight text-gray-500 dark:text-gray-400">
                Animal Resources Information System
              </p>
            </div>
          </Link>

          {/* Breadcrumb */}
          {crumbs.length > 1 && (
            <nav className="ml-2 hidden items-center gap-1 text-sm md:flex" aria-label="Breadcrumb">
              {crumbs.map((crumb, i) => (
                <span key={crumb.href} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                  {i === crumbs.length - 1 ? (
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>

        {/* Right: Language + Login shortcut */}
        <div className="flex items-center gap-3">
          <select
            className="rounded-md border border-gray-300 bg-transparent px-2 py-1.5 text-xs font-medium text-gray-700 focus:outline-none dark:border-gray-600 dark:text-gray-300"
            defaultValue="en"
          >
            <option value="en">EN</option>
            <option value="fr">FR</option>
            <option value="pt">PT</option>
            <option value="ar">AR</option>
          </select>
          <a
            href="#login-panel"
            className="hidden rounded-lg bg-[#006B3F] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#005A34] sm:inline-flex"
          >
            Sign in
          </a>
        </div>
      </div>
    </header>
  );
}
