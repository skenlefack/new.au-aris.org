'use client';

import React, { useState, useMemo } from 'react';
import {
  Database,
  Calendar,
  Layers,
  Clock,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type Domain =
  | 'Animal Health'
  | 'Livestock'
  | 'Fisheries'
  | 'Wildlife'
  | 'Apiculture'
  | 'Trade'
  | 'Governance'
  | 'Climate';

type Source = 'FAOSTAT' | 'National Census' | 'ARIS' | 'WAHIS';

interface HistoricalRecord {
  id: string;
  entity: string;
  domain: Domain;
  country: string;
  countryCode: string;
  year: number;
  value: number;
  unit: string;
  source: Source;
  version: number;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Badge colour maps                                                   */
/* ------------------------------------------------------------------ */

const DOMAIN_BADGE: Record<Domain, string> = {
  'Animal Health': 'bg-red-100 text-red-700',
  Livestock: 'bg-amber-100 text-amber-700',
  Fisheries: 'bg-blue-100 text-blue-700',
  Wildlife: 'bg-green-100 text-green-700',
  Apiculture: 'bg-yellow-100 text-yellow-700',
  Trade: 'bg-purple-100 text-purple-700',
  Governance: 'bg-orange-100 text-orange-700',
  Climate: 'bg-teal-100 text-teal-700',
};

const SOURCE_BADGE: Record<Source, string> = {
  FAOSTAT: 'bg-blue-100 text-blue-700',
  'National Census': 'bg-green-100 text-green-700',
  ARIS: 'bg-gray-100 text-gray-600',
  WAHIS: 'bg-red-100 text-red-700',
};

/* ------------------------------------------------------------------ */
/*  Filter options                                                      */
/* ------------------------------------------------------------------ */

const DOMAINS: Domain[] = [
  'Animal Health',
  'Livestock',
  'Fisheries',
  'Wildlife',
  'Apiculture',
  'Trade',
  'Governance',
  'Climate',
];

const ENTITY_TYPES = [
  'All Types',
  'Population',
  'Outbreaks',
  'Captures',
  'Production',
  'Exports',
  'Vaccinations',
  'Facilities',
  'Index',
];

/* ------------------------------------------------------------------ */
/*  Placeholder data — 10 rows with realistic AU data                   */
/* ------------------------------------------------------------------ */

const PLACEHOLDER_DATA: HistoricalRecord[] = [
  {
    id: 'hr-1',
    entity: 'Cattle Population',
    domain: 'Livestock',
    country: 'Kenya',
    countryCode: 'KE',
    year: 2025,
    value: 18_400_000,
    unit: 'heads',
    source: 'FAOSTAT',
    version: 3,
    updatedAt: '2026-02-28T14:00:00Z',
  },
  {
    id: 'hr-2',
    entity: 'FMD Outbreaks',
    domain: 'Animal Health',
    country: 'Ethiopia',
    countryCode: 'ET',
    year: 2024,
    value: 47,
    unit: 'events',
    source: 'WAHIS',
    version: 2,
    updatedAt: '2026-01-15T10:30:00Z',
  },
  {
    id: 'hr-3',
    entity: 'Fish Captures',
    domain: 'Fisheries',
    country: 'Nigeria',
    countryCode: 'NG',
    year: 2025,
    value: 1_024_500,
    unit: 'tonnes',
    source: 'National Census',
    version: 1,
    updatedAt: '2026-03-01T09:00:00Z',
  },
  {
    id: 'hr-4',
    entity: 'Honey Production',
    domain: 'Apiculture',
    country: 'Senegal',
    countryCode: 'SN',
    year: 2024,
    value: 12_300,
    unit: 'tonnes',
    source: 'ARIS',
    version: 1,
    updatedAt: '2025-12-20T16:00:00Z',
  },
  {
    id: 'hr-5',
    entity: 'Elephant Population',
    domain: 'Wildlife',
    country: 'Tanzania',
    countryCode: 'TZ',
    year: 2025,
    value: 60_200,
    unit: 'individuals',
    source: 'National Census',
    version: 4,
    updatedAt: '2026-02-10T11:00:00Z',
  },
  {
    id: 'hr-6',
    entity: 'Live Animal Exports',
    domain: 'Trade',
    country: 'Djibouti',
    countryCode: 'DJ',
    year: 2024,
    value: 3_250_000,
    unit: 'heads',
    source: 'ARIS',
    version: 2,
    updatedAt: '2026-01-28T08:00:00Z',
  },
  {
    id: 'hr-7',
    entity: 'Veterinary Labs',
    domain: 'Governance',
    country: 'South Africa',
    countryCode: 'ZA',
    year: 2025,
    value: 42,
    unit: 'facilities',
    source: 'ARIS',
    version: 1,
    updatedAt: '2026-03-05T12:00:00Z',
  },
  {
    id: 'hr-8',
    entity: 'Water Stress Index',
    domain: 'Climate',
    country: 'Egypt',
    countryCode: 'EG',
    year: 2024,
    value: 78.4,
    unit: '%',
    source: 'FAOSTAT',
    version: 2,
    updatedAt: '2025-11-30T14:30:00Z',
  },
  {
    id: 'hr-9',
    entity: 'PPR Vaccinations',
    domain: 'Animal Health',
    country: 'Uganda',
    countryCode: 'UG',
    year: 2025,
    value: 2_150_000,
    unit: 'doses',
    source: 'WAHIS',
    version: 1,
    updatedAt: '2026-02-18T07:45:00Z',
  },
  {
    id: 'hr-10',
    entity: 'Aquaculture Production',
    domain: 'Fisheries',
    country: 'Ghana',
    countryCode: 'GH',
    year: 2024,
    value: 84_700,
    unit: 'tonnes',
    source: 'National Census',
    version: 3,
    updatedAt: '2026-01-05T10:00:00Z',
  },
];

/* ------------------------------------------------------------------ */
/*  Page component                                                      */
/* ------------------------------------------------------------------ */

export default function HistoricalDataPage() {
  /* --- filter state --- */
  const [domainFilter, setDomainFilter] = useState<string>('');
  const [countrySearch, setCountrySearch] = useState('');
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const limit = 5;

  /* --- filtering logic --- */
  const filtered = useMemo(() => {
    let rows = PLACEHOLDER_DATA;

    if (domainFilter) {
      rows = rows.filter((r) => r.domain === domainFilter);
    }
    if (countrySearch.trim()) {
      const q = countrySearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.country.toLowerCase().includes(q) ||
          r.countryCode.toLowerCase().includes(q),
      );
    }
    if (yearFrom) {
      rows = rows.filter((r) => r.year >= Number(yearFrom));
    }
    if (yearTo) {
      rows = rows.filter((r) => r.year <= Number(yearTo));
    }
    if (entityType && entityType !== 'All Types') {
      const q = entityType.toLowerCase();
      rows = rows.filter((r) => r.entity.toLowerCase().includes(q));
    }

    return rows;
  }, [domainFilter, countrySearch, yearFrom, yearTo, entityType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const paged = filtered.slice((page - 1) * limit, page * limit);

  /* --- KPI computations --- */
  const totalRecords = PLACEHOLDER_DATA.length;
  const years = PLACEHOLDER_DATA.map((r) => r.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const timeSpan = maxYear - minYear + 1;
  const domainsCovered = new Set(PLACEHOLDER_DATA.map((r) => r.domain)).size;
  const lastUpdated = PLACEHOLDER_DATA.reduce((latest, r) =>
    r.updatedAt > latest.updatedAt ? r : latest,
  ).updatedAt;

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historical Data</h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse time series, trends and versioned records across all domains
          </p>
        </div>
        <button
          onClick={() => {
            /* placeholder CSV export */
          }}
          className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-aris-primary-700"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* ---- KPI Cards ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Records */}
        <div className="rounded-card border border-gray-200 bg-white p-card shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs uppercase tracking-wider text-gray-500">
              Total Records
            </span>
            <Database className="h-5 w-5 text-gray-300" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {totalRecords.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-gray-400">Across all domains</p>
        </div>

        {/* Time Span */}
        <div className="rounded-card border border-blue-200 bg-blue-50 p-card shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs uppercase tracking-wider text-blue-600">
              Time Span
            </span>
            <Calendar className="h-5 w-5 text-blue-300" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-700">
            {timeSpan} {timeSpan === 1 ? 'year' : 'years'}
          </p>
          <p className="mt-1 text-xs text-blue-500">
            {minYear} &ndash; {maxYear}
          </p>
        </div>

        {/* Domains Covered */}
        <div className="rounded-card border border-aris-primary-200 bg-aris-primary-50 p-card shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs uppercase tracking-wider text-aris-primary-600">
              Domains Covered
            </span>
            <Layers className="h-5 w-5 text-aris-primary-300" />
          </div>
          <p className="mt-2 text-2xl font-bold text-aris-primary-700">
            {domainsCovered}
          </p>
          <p className="mt-1 text-xs text-aris-primary-500">
            Out of 8 total domains
          </p>
        </div>

        {/* Last Updated */}
        <div className="rounded-card border border-orange-200 bg-orange-50 p-card shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs uppercase tracking-wider text-orange-600">
              Last Updated
            </span>
            <Clock className="h-5 w-5 text-orange-300" />
          </div>
          <p className="mt-2 text-2xl font-bold text-orange-700">
            {new Date(lastUpdated).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          <p className="mt-1 text-xs text-orange-500">
            {new Date(lastUpdated).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* ---- Filters Row ---- */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Domain selector */}
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
            <option value="">All Domains</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Country search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search country..."
            value={countrySearch}
            onChange={(e) => {
              setCountrySearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
          />
        </div>

        {/* Year from */}
        <input
          type="number"
          placeholder="From year"
          min={2000}
          max={2030}
          value={yearFrom}
          onChange={(e) => {
            setYearFrom(e.target.value);
            setPage(1);
          }}
          className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none"
        />

        {/* Year to */}
        <input
          type="number"
          placeholder="To year"
          min={2000}
          max={2030}
          value={yearTo}
          onChange={(e) => {
            setYearTo(e.target.value);
            setPage(1);
          }}
          className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none"
        />

        {/* Entity type */}
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
        >
          <option value="">Entity Type</option>
          {ENTITY_TYPES.map((et) => (
            <option key={et} value={et}>
              {et}
            </option>
          ))}
        </select>
      </div>

      {/* ---- Data Table ---- */}
      <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Entity</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Domain</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Country</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Year</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Value</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Unit</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Version</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paged.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{row.entity}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                        DOMAIN_BADGE[row.domain],
                      )}
                    >
                      {row.domain}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.country}
                    <span className="ml-1 text-xs text-gray-400">
                      ({row.countryCode})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.year}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {row.value.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{row.unit}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                        SOURCE_BADGE[row.source],
                      )}
                    >
                      {row.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">
                    v{row.version}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(row.updatedAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No records found matching the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500">
            Showing {paged.length} of {filtered.length} records
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
              Page {page} of {totalPages}
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
    </div>
  );
}
