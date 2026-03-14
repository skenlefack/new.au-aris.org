'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  Users,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePublications, type Publication } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useTranslations } from '@/lib/i18n/translations';

const TYPE_BADGE: Record<string, string> = {
  brief: 'bg-blue-100 text-blue-700',
  report: 'bg-green-100 text-green-700',
  guideline: 'bg-amber-100 text-amber-700',
  dataset: 'bg-purple-100 text-purple-700',
  infographic: 'bg-pink-100 text-pink-700',
};

const PLACEHOLDER_PUBLICATIONS: Publication[] = [
  {
    id: 'pub-1',
    title: 'Continental Strategy for the Control of FMD in Africa 2026',
    description: 'Comprehensive strategy document outlining coordinated approaches to Foot-and-Mouth Disease control across AU Member States, including vaccination, surveillance, and movement control measures aligned with the progressive control pathway.',
    domain: 'Animal Health',
    type: 'report',
    authors: ['AU-IBAR', 'FAO', 'WOAH'],
    publishedAt: '2026-02-10T00:00:00Z',
    language: 'English',
    downloadUrl: '/downloads/fmd-strategy-2026.pdf',
    tags: ['FMD', 'strategy', 'continental'],
    downloads: 1245,
    createdAt: '2026-02-10T00:00:00Z',
  },
  {
    id: 'pub-2',
    title: 'Policy Brief: Transhumance Corridors and Trade Facilitation',
    description: 'Analysis of cross-border livestock movement patterns in the Sahel and their implications for trade policy under the African Continental Free Trade Area agreement.',
    domain: 'Trade & Markets',
    type: 'brief',
    authors: ['Dr. Akinwumi Ade', 'Prof. Fatima Ndiaye'],
    publishedAt: '2026-01-25T00:00:00Z',
    language: 'English',
    downloadUrl: '/downloads/transhumance-brief.pdf',
    tags: ['transhumance', 'trade', 'AfCFTA'],
    downloads: 892,
    createdAt: '2026-01-25T00:00:00Z',
  },
  {
    id: 'pub-3',
    title: 'Guidelines for Aquatic Animal Health Surveillance in Africa',
    description: 'Technical guidelines for establishing and maintaining aquatic animal health surveillance systems at national level, covering both freshwater and marine species as recommended by WOAH.',
    domain: 'Fisheries',
    type: 'guideline',
    authors: ['AU-IBAR Fisheries Unit'],
    publishedAt: '2026-01-15T00:00:00Z',
    language: 'English',
    downloadUrl: '/downloads/aquatic-surveillance-guidelines.pdf',
    tags: ['fisheries', 'surveillance', 'aquatic health'],
    downloads: 567,
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'pub-4',
    title: 'African Livestock Census Data 2025',
    description: 'Comprehensive dataset containing livestock population figures from 48 reporting Member States, including cattle, sheep, goats, camels, and poultry disaggregated by administrative regions.',
    domain: 'Production',
    type: 'dataset',
    authors: ['ARIS Data Team'],
    publishedAt: '2026-01-05T00:00:00Z',
    language: 'English',
    downloadUrl: '/downloads/livestock-census-2025.csv',
    tags: ['census', 'livestock', 'data'],
    downloads: 2340,
    createdAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 'pub-5',
    title: 'AMR Surveillance Framework for Veterinary Services',
    description: 'Framework document for integrating antimicrobial resistance surveillance within national veterinary services, aligned with the One Health approach and Global Action Plan on AMR.',
    domain: 'Animal Health',
    type: 'guideline',
    authors: ['Dr. Bonaventure Mtei', 'Dr. Hiver Boussini'],
    publishedAt: '2025-12-20T00:00:00Z',
    language: 'English',
    downloadUrl: '/downloads/amr-framework.pdf',
    tags: ['AMR', 'surveillance', 'One Health'],
    downloads: 734,
    createdAt: '2025-12-20T00:00:00Z',
  },
  {
    id: 'pub-6',
    title: 'Infographic: African Honey Production by Region',
    description: 'Visual summary of honey production volumes, major bee species, and export trends across the five African regions for the 2024-2025 season.',
    domain: 'Apiculture',
    type: 'infographic',
    authors: ['AU-IBAR Communications'],
    publishedAt: '2025-12-10T00:00:00Z',
    language: 'English',
    downloadUrl: '/downloads/honey-infographic-2025.png',
    tags: ['apiculture', 'honey', 'production'],
    downloads: 1567,
    createdAt: '2025-12-10T00:00:00Z',
  },
];

export default function PublicationsPage() {
  const t = useTranslations('knowledge');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const limit = 9;

  const { data, isLoading, isError, error, refetch } = usePublications({
    page,
    limit,
    domain: domainFilter || undefined,
    type: typeFilter || undefined,
    search: search || undefined,
  });

  const publications = data?.data ?? PLACEHOLDER_PUBLICATIONS;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_PUBLICATIONS.length,
    page: 1,
    limit: 9,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/knowledge"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('publications')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchPublications')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={domainFilter}
            onChange={(e) => {
              setDomainFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allDomains')}</option>
            <option value="Animal Health">Animal Health</option>
            <option value="Trade & Markets">Trade & Markets</option>
            <option value="Fisheries">Fisheries</option>
            <option value="Production">Production</option>
            <option value="Apiculture">Apiculture</option>
            <option value="Wildlife">Wildlife</option>
            <option value="Governance">Governance</option>
            <option value="Climate">Climate</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allTypes')}</option>
            <option value="brief">{t('brief')}</option>
            <option value="report">{t('report')}</option>
            <option value="guideline">{t('guideline')}</option>
            <option value="dataset">{t('dataset')}</option>
            <option value="infographic">{t('infographic')}</option>
          </select>
        </div>
      </div>

      {/* Card Grid */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load publications'}
          onRetry={() => refetch()}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publications.map((pub) => (
              <div
                key={pub.id}
                className="flex flex-col rounded-card border border-gray-200 bg-white p-4 hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      TYPE_BADGE[pub.type],
                    )}
                  >
                    {pub.type}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(pub.publishedAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-gray-900 line-clamp-2">
                  {pub.title}
                </h3>
                <p className="mt-1 flex-1 text-xs text-gray-500 line-clamp-2">
                  {pub.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Globe className="h-3 w-3" />
                    {pub.domain}
                  </span>
                  <span className="text-xs text-gray-300">|</span>
                  <span className="text-xs text-gray-400">{pub.language}</span>
                  <span className="text-xs text-gray-300">|</span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Download className="h-3 w-3" />
                    {pub.downloads.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                  <Users className="h-3 w-3" />
                  <span className="line-clamp-1">{pub.authors.join(', ')}</span>
                </div>
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <a
                    href={pub.downloadUrl}
                    className="flex items-center justify-center gap-2 rounded-lg border border-aris-primary-200 px-3 py-1.5 text-xs font-medium text-aris-primary-600 hover:bg-aris-primary-50"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {t('download')}
                  </a>
                </div>
              </div>
            ))}
            {publications.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-400">
                {t('noPublications')}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between rounded-card border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">
              {t('showingOf', { count: publications.length, total: meta.total })}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-gray-600">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
