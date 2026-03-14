'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  MapPin,
  Syringe,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHealthEvents, type HealthEvent } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { DomainCampaignsSection } from '@/components/domain/DomainCampaignsSection';
import { QuickAlertCard, type AlertField } from '@/components/domain/QuickAlertCard';
import { useTranslations } from '@/lib/i18n/translations';

const ANIMAL_HEALTH_ALERT_FIELDS: AlertField[] = [
  { name: 'disease', label: 'Disease', type: 'text', placeholder: 'e.g. Foot-and-Mouth Disease', required: true },
  { name: 'species', label: 'Species', type: 'text', placeholder: 'e.g. Cattle', required: true },
  { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Rift Valley, KE', required: true },
  { name: 'severity', label: 'Severity', type: 'select', required: true, options: ['Low', 'Medium', 'High', 'Critical'] },
  { name: 'cases', label: 'Estimated Cases', type: 'text', placeholder: 'e.g. 50' },
];

const STATUS_BADGE: Record<string, string> = {
  suspected: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

const SEVERITY_BADGE: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const PLACEHOLDER_EVENTS: HealthEvent[] = [
  {
    id: 'ev-1', disease: 'Foot-and-Mouth Disease', diseaseCode: 'FMD',
    country: 'Kenya', countryCode: 'KE', region: 'Rift Valley',
    lat: -1.286, lng: 36.817, status: 'confirmed', severity: 'high',
    cases: 234, deaths: 12, speciesAffected: ['Cattle', 'Goat'],
    reportedAt: '2026-02-15T10:30:00Z', confirmedAt: '2026-02-16T14:00:00Z',
    reportedBy: 'Dr. Ochieng', validationLevel: 2, workflowStatus: 'pending_l2',
    dataQualityScore: 92, createdAt: '2026-02-15T10:30:00Z', updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'ev-2', disease: 'Peste des Petits Ruminants', diseaseCode: 'PPR',
    country: 'Ethiopia', countryCode: 'ET', region: 'Oromia',
    lat: 9.005, lng: 38.763, status: 'confirmed', severity: 'critical',
    cases: 412, deaths: 67, speciesAffected: ['Sheep', 'Goat'],
    reportedAt: '2026-02-10T08:00:00Z', confirmedAt: '2026-02-12T11:30:00Z',
    reportedBy: 'Dr. Bekele', validationLevel: 3, workflowStatus: 'pending_l3',
    dataQualityScore: 88, createdAt: '2026-02-10T08:00:00Z', updatedAt: '2026-02-17T16:00:00Z',
  },
  {
    id: 'ev-3', disease: 'Highly Pathogenic Avian Influenza', diseaseCode: 'HPAI',
    country: 'Nigeria', countryCode: 'NG', region: 'Kano',
    lat: 9.06, lng: 7.49, status: 'confirmed', severity: 'critical',
    cases: 89, deaths: 89, speciesAffected: ['Poultry'],
    reportedAt: '2026-02-08T06:00:00Z', confirmedAt: '2026-02-09T10:00:00Z',
    reportedBy: 'Dr. Adamu', validationLevel: 2, workflowStatus: 'approved_l2',
    dataQualityScore: 95, createdAt: '2026-02-08T06:00:00Z', updatedAt: '2026-02-14T12:00:00Z',
  },
  {
    id: 'ev-4', disease: 'African Swine Fever', diseaseCode: 'ASF',
    country: 'Senegal', countryCode: 'SN', region: 'Dakar',
    lat: 14.693, lng: -17.444, status: 'suspected', severity: 'medium',
    cases: 45, deaths: 8, speciesAffected: ['Pig'],
    reportedAt: '2026-02-18T14:00:00Z',
    reportedBy: 'Dr. Diop', validationLevel: 1, workflowStatus: 'pending_l1',
    dataQualityScore: 76, createdAt: '2026-02-18T14:00:00Z', updatedAt: '2026-02-19T08:00:00Z',
  },
  {
    id: 'ev-5', disease: 'Rift Valley Fever', diseaseCode: 'RVF',
    country: 'Tanzania', countryCode: 'TZ', region: 'Arusha',
    lat: -6.162, lng: 35.75, status: 'resolved', severity: 'low',
    cases: 12, deaths: 0, speciesAffected: ['Cattle'],
    reportedAt: '2026-01-20T09:00:00Z', confirmedAt: '2026-01-22T15:00:00Z',
    resolvedAt: '2026-02-10T10:00:00Z',
    reportedBy: 'Dr. Mwanga', validationLevel: 4, workflowStatus: 'approved_l4',
    dataQualityScore: 97, createdAt: '2026-01-20T09:00:00Z', updatedAt: '2026-02-10T10:00:00Z',
  },
  {
    id: 'ev-6', disease: 'Lumpy Skin Disease', diseaseCode: 'LSD',
    country: 'Egypt', countryCode: 'EG', region: 'Nile Delta',
    lat: 30.044, lng: 31.236, status: 'confirmed', severity: 'high',
    cases: 156, deaths: 23, speciesAffected: ['Cattle'],
    reportedAt: '2026-02-05T12:00:00Z', confirmedAt: '2026-02-07T09:00:00Z',
    reportedBy: 'Dr. Hassan', validationLevel: 2, workflowStatus: 'pending_l2',
    dataQualityScore: 91, createdAt: '2026-02-05T12:00:00Z', updatedAt: '2026-02-16T14:00:00Z',
  },
  {
    id: 'ev-7', disease: 'Newcastle Disease', diseaseCode: 'ND',
    country: 'Ghana', countryCode: 'GH', region: 'Greater Accra',
    lat: 5.614, lng: -0.186, status: 'confirmed', severity: 'low',
    cases: 23, deaths: 5, speciesAffected: ['Poultry'],
    reportedAt: '2026-02-12T11:00:00Z', confirmedAt: '2026-02-13T16:00:00Z',
    reportedBy: 'Dr. Mensah', validationLevel: 1, workflowStatus: 'approved_l1',
    dataQualityScore: 85, createdAt: '2026-02-12T11:00:00Z', updatedAt: '2026-02-15T10:00:00Z',
  },
];

export default function AnimalHealthPage() {
  const t = useTranslations('animalHealth');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useHealthEvents({
    page,
    limit,
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
    search: search || undefined,
  });

  const events = data?.data ?? PLACEHOLDER_EVENTS;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_EVENTS.length,
    page: 1,
    limit: 10,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/animal-health/map"
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <MapPin className="h-4 w-4" />
            {t('mapView')}
          </Link>
          <Link
            href="/animal-health/vaccination"
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Syringe className="h-4 w-4" />
            {t('vaccination')}
          </Link>
          <Link
            href="/animal-health/events/new"
            className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            {t('reportEvent')}
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchEvents')}
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
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allStatus')}</option>
            <option value="suspected">{t('suspected')}</option>
            <option value="confirmed">{t('confirmed')}</option>
            <option value="resolved">{t('resolved')}</option>
            <option value="closed">{t('closed')}</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allSeverity')}</option>
            <option value="low">{t('low')}</option>
            <option value="medium">{t('medium')}</option>
            <option value="high">{t('high')}</option>
            <option value="critical">{t('critical')}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={7} cols={8} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load events'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('disease')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('country')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('status')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('severity')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('cases')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('deaths')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('species')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('reported')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map((ev) => (
                  <tr key={ev.id} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/animal-health/events/${ev.id}`}
                        className="font-medium text-gray-900 hover:text-aris-primary-600"
                      >
                        {ev.disease}
                      </Link>
                      <p className="text-xs text-gray-400">{ev.diseaseCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {ev.country}
                      <p className="text-xs text-gray-400">{ev.region}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_BADGE[ev.status])}>
                        {ev.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize', SEVERITY_BADGE[ev.severity])}>
                        {ev.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{ev.cases.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{ev.deaths.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-700">{ev.speciesAffected.join(', ')}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(ev.reportedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      {t('noEventsFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              {t('showingEvents', { count: events.length.toString(), total: meta.total.toString() })}
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
        </div>
      )}

      {/* Campaigns & Alert */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DomainCampaignsSection domain="animal_health" />
        <QuickAlertCard domain="animal_health" alertFields={ANIMAL_HEALTH_ALERT_FIELDS} title={t('reportHealthEvent')} />
      </div>
    </div>
  );
}
