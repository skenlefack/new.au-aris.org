'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const LABEL_MAP: Record<string, string> = {
  '': 'Home',
  'animal-health': 'Animal Health',
  events: 'Events',
  new: 'New Event',
  map: 'Map',
  outbreaks: 'Outbreaks',
  vaccination: 'Vaccination',
  laboratory: 'Laboratory',
  surveillance: 'Surveillance',
  livestock: 'Livestock & Production',
  census: 'Census',
  production: 'Production',
  transhumance: 'Transhumance',
  fisheries: 'Fisheries & Aquaculture',
  captures: 'Captures',
  vessels: 'Vessels',
  aquaculture: 'Aquaculture',
  trade: 'Trade & SPS',
  flows: 'Trade Flows',
  sps: 'SPS Certificates',
  markets: 'Market Prices',
  knowledge: 'Knowledge Hub',
  publications: 'Publications',
  elearning: 'E-Learning',
  faq: 'FAQ',
  collecte: 'Collecte',
  campaigns: 'Campaigns',
  submissions: 'Submissions',
  workflow: 'Workflow',
  'master-data': 'Master Data',
  geo: 'Geography',
  species: 'Species',
  denominators: 'Denominators',
  quality: 'Data Quality',
  interop: 'Interop Hub',
  'form-builder': 'Form Builder',
  analytics: 'Analytics',
  trends: 'Trends',
  comparison: 'Country Comparison',
  export: 'Export Builder',
  reports: 'Reports',
  generate: 'Generate Report',
  history: 'Report History',
  settings: 'Settings',
  profile: 'Profile',
  'data-contracts': 'Data Contracts',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const label = LABEL_MAP[seg] ?? seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const isLast = i === segments.length - 1;
    return { label, href, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link
        href="/"
        className="flex items-center text-gray-400 hover:text-gray-600"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((crumb) => (
        <React.Fragment key={crumb.href}>
          <ChevronRight className="h-3 w-3 text-gray-300" />
          {crumb.isLast ? (
            <span className="font-medium text-gray-700">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-gray-400 hover:text-gray-600"
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
