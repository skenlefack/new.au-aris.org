'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFaqItems, type FaqItem } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useTranslations } from '@/lib/i18n/translations';

const DOMAIN_BADGE: Record<string, string> = {
  'General': 'bg-gray-100 text-gray-700',
  'Animal Health': 'bg-red-100 text-red-700',
  'Trade & SPS': 'bg-blue-100 text-blue-700',
  'Fisheries': 'bg-cyan-100 text-cyan-700',
  'Production': 'bg-amber-100 text-amber-700',
  'Wildlife': 'bg-green-100 text-green-700',
  'Data Quality': 'bg-purple-100 text-purple-700',
  'Platform': 'bg-indigo-100 text-indigo-700',
};

const DOMAIN_FILTERS = [
  'All',
  'General',
  'Animal Health',
  'Trade & SPS',
  'Fisheries',
  'Production',
  'Wildlife',
  'Data Quality',
  'Platform',
];

const PLACEHOLDER_FAQ: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'What is ARIS and who is it designed for?',
    answer: 'ARIS (Animal Resources Information System) is the digital backbone of the African Union\'s Inter-African Bureau for Animal Resources (AU-IBAR). It is a federated system covering all animal resources across 55 AU Member States and 8 Regional Economic Communities (RECs). It is designed for national veterinary services, data stewards, WAHIS focal points, analysts, and field agents involved in animal health, livestock production, fisheries, wildlife, and trade management.',
    domain: 'General',
    order: 1,
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'faq-2',
    question: 'How does the 4-level validation workflow operate?',
    answer: 'The ARIS validation workflow has four levels: Level 1 is technical validation by the National Data Steward who verifies data passes quality gates. Level 2 is official national approval by the Data Owner or Chief Veterinary Officer, making the data WAHIS-ready. Level 3 is regional harmonization by the REC Data Steward who checks cross-border consistency. Level 4 is continental analytics by AU-IBAR for publication with appropriate disclaimers. Two parallel tracks exist: the official track (after L2 for WAHIS export) and the analytical track (after L4 for dashboards).',
    domain: 'Data Quality',
    order: 2,
    updatedAt: '2026-01-28T00:00:00Z',
  },
  {
    id: 'faq-3',
    question: 'How do I report a disease outbreak in ARIS?',
    answer: 'To report a disease outbreak, navigate to Animal Health and click "Report Event". Fill in the required fields including disease, location, species affected, and clinical findings. Attach any laboratory samples collected. The report will enter the validation workflow starting at Level 1. Once confirmed by lab results and approved at Level 2, the event becomes eligible for WAHIS notification by the designated WAHIS Focal Point.',
    domain: 'Animal Health',
    order: 3,
    updatedAt: '2026-02-05T00:00:00Z',
  },
  {
    id: 'faq-4',
    question: 'What are the data quality gates that my submissions must pass?',
    answer: 'All records must pass 8 mandatory quality gates before publication: (1) Completeness: key fields must be filled. (2) Temporal consistency: dates must follow logical order (confirmation after suspicion). (3) Geographic consistency: admin codes must be valid and coordinates within boundaries. (4) Codes and vocabularies: species, diseases, and zones must match Master Data referentials. (5) Units: must be valid and consistent. (6) Deduplication: deterministic and probabilistic matching. (7) Auditability: source system and responsible unit must be present. (8) Confidence score: auto-calculated based on evidence level.',
    domain: 'Data Quality',
    order: 4,
    updatedAt: '2026-01-20T00:00:00Z',
  },
  {
    id: 'faq-5',
    question: 'How does ARIS integrate with WAHIS and EMPRES?',
    answer: 'ARIS provides WAHIS-ready export packages containing events, six-monthly reports, annual reports, and self-assessment capacities in JSON/XML format aligned with WOAH standards. The integration is near-real-time for immediate notifications and periodic for routine reports. For EMPRES, ARIS exports signals with confidence levels, geographic context, and metadata in JSON format. All interoperability packages are managed through the Interop Hub module.',
    domain: 'Animal Health',
    order: 5,
    updatedAt: '2026-02-10T00:00:00Z',
  },
  {
    id: 'faq-6',
    question: 'How are trade flows and SPS certificates managed in ARIS?',
    answer: 'The Trade and SPS module allows tracking of import/export flows of animal products between Member States, with HS code classification and FOB valuation. SPS certificates can be created, issued, and verified digitally. Each certificate links to an inspection result (Pass/Fail/Conditional) and is signed by authorized certifying officers. The module supports AfCFTA requirements for intra-African trade facilitation.',
    domain: 'Trade & SPS',
    order: 6,
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'faq-7',
    question: 'How does ARIS handle fisheries data aligned with FishStatJ?',
    answer: 'The Fisheries module captures marine and inland fisheries data, vessel registrations, licenses, and aquaculture production. Data is structured to align with FAO FishStatJ standards using FAO species codes and fishing areas. Capture records include species, catch method, landing site, and quantities. The module also supports fleet management with vessel registration, tonnage tracking, and license status monitoring.',
    domain: 'Fisheries',
    order: 7,
    updatedAt: '2026-02-08T00:00:00Z',
  },
  {
    id: 'faq-8',
    question: 'What roles are available in ARIS and how do permissions work?',
    answer: 'ARIS has 8 roles organized by tenant hierarchy: Super Admin (system administration), Continental Admin (AU-IBAR program officers), REC Admin (regional coordinators), National Admin (CVO office), Data Steward (quality officers), WAHIS Focal Point (authorized WOAH reporters), Analyst (read-only), and Field Agent (mobile data collectors). Permissions cascade through the tenant hierarchy: AU-IBAR sees all data, RECs see their Member States, and Member States see only their own data. All access is governed by JWT-based authentication with RBAC enforcement.',
    domain: 'Platform',
    order: 8,
    updatedAt: '2026-02-12T00:00:00Z',
  },
];

export default function FaqPage() {
  const t = useTranslations('knowledge');
  const [domainFilter, setDomainFilter] = useState('All');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error, refetch } = useFaqItems(
    domainFilter !== 'All' ? { domain: domainFilter } : undefined,
  );

  const faqItems = data?.data ?? PLACEHOLDER_FAQ;

  const filteredItems = domainFilter === 'All'
    ? faqItems
    : faqItems.filter((item) => item.domain === domainFilter);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
          <h1 className="text-2xl font-bold text-gray-900">
            {t('faqTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('faqDesc')}
          </p>
        </div>
      </div>

      {/* Domain filter pills */}
      <div className="flex flex-wrap gap-2">
        {DOMAIN_FILTERS.map((domain) => (
          <button
            key={domain}
            onClick={() => setDomainFilter(domain)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              domainFilter === domain
                ? 'bg-aris-primary-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            {domain}
          </button>
        ))}
      </div>

      {/* FAQ Accordion */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={2} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load FAQ'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const isOpen = openItems.has(item.id);
            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-card border border-gray-200 bg-white"
              >
                <button
                  onClick={() => toggleItem(item.id)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-gray-50"
                >
                  <div className="flex-shrink-0">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-aris-primary-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      'text-sm font-medium',
                      isOpen ? 'text-aris-primary-700' : 'text-gray-900',
                    )}>
                      {item.question}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      DOMAIN_BADGE[item.domain] ?? 'bg-gray-100 text-gray-700',
                    )}
                  >
                    {item.domain}
                  </span>
                </button>
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-200 ease-in-out',
                    isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0',
                  )}
                >
                  <div className="border-t border-gray-100 px-5 py-4 pl-12">
                    <p className="text-sm leading-relaxed text-gray-600">
                      {item.answer}
                    </p>
                    <p className="mt-3 text-xs text-gray-400">
                      Last updated: {new Date(item.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredItems.length === 0 && (
            <div className="rounded-card border border-gray-200 bg-white px-4 py-12 text-center text-gray-400">
              No FAQ items found for this domain
            </div>
          )}
        </div>
      )}
    </div>
  );
}
