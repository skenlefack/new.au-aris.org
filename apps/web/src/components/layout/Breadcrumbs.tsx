'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

/**
 * Standalone breadcrumb component.
 * Note: Breadcrumbs are also rendered inline in the Header.
 * This component is kept for pages that need breadcrumbs outside the header.
 */
export function Breadcrumbs() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const LABEL_MAP: Record<string, string> = {
    '': t('breadcrumbHome'),
    home: t('breadcrumbHome'),
    'animal-health': t('breadcrumbAnimalHealth'),
    events: t('breadcrumbEvents'),
    new: t('breadcrumbNew'),
    map: t('breadcrumbMap'),
    outbreaks: t('breadcrumbOutbreaks'),
    vaccination: t('breadcrumbVaccination'),
    laboratory: t('breadcrumbLaboratory'),
    surveillance: t('breadcrumbSurveillance'),
    livestock: t('breadcrumbLivestock'),
    census: t('breadcrumbCensus'),
    production: t('breadcrumbProduction'),
    transhumance: t('breadcrumbTranshumance'),
    fisheries: t('breadcrumbFisheries'),
    captures: t('breadcrumbCaptures'),
    vessels: t('breadcrumbVessels'),
    aquaculture: t('breadcrumbAquaculture'),
    trade: t('breadcrumbTrade'),
    flows: t('breadcrumbFlows'),
    sps: t('breadcrumbSps'),
    markets: t('breadcrumbMarkets'),
    knowledge: t('breadcrumbKnowledge'),
    publications: t('breadcrumbPublications'),
    elearning: t('breadcrumbElearning'),
    faq: t('breadcrumbFaq'),
    collecte: t('breadcrumbCollecte'),
    campaigns: t('breadcrumbCampaigns'),
    submissions: t('breadcrumbSubmissions'),
    workflow: t('breadcrumbWorkflow'),
    'master-data': t('breadcrumbMasterData'),
    geo: t('breadcrumbGeo'),
    species: t('breadcrumbSpecies'),
    denominators: t('breadcrumbDenominators'),
    quality: t('breadcrumbQuality'),
    interop: t('breadcrumbInterop'),
    'form-builder': t('breadcrumbFormBuilder'),
    analytics: t('breadcrumbAnalytics'),
    trends: t('breadcrumbTrends'),
    comparison: t('breadcrumbComparison'),
    export: t('breadcrumbExport'),
    reports: t('breadcrumbReports'),
    generate: t('breadcrumbGenerate'),
    history: t('breadcrumbHistory'),
    settings: t('breadcrumbSettings'),
    profile: t('breadcrumbProfile'),
    'data-contracts': t('breadcrumbDataContracts'),
    general: t('breadcrumbGeneral'),
    security: t('breadcrumbSecurity'),
    i18n: t('breadcrumbI18n'),
    'data-quality': t('breadcrumbDataQuality'),
    countries: t('breadcrumbCountries'),
    domains: t('breadcrumbDomains'),
    recs: t('breadcrumbRecs'),
    audit: t('breadcrumbAudit'),
    system: t('breadcrumbSystem'),
  };

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
        href="/home"
        className="flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((crumb) => (
        <React.Fragment key={crumb.href}>
          <ChevronRight className="h-3 w-3 text-gray-300 dark:text-gray-600" />
          {crumb.isLast ? (
            <span
              className="font-medium"
              style={{ color: 'var(--color-accent)' }}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
