'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Globe,
  Bug,
  PawPrint,
  Calculator,
  Ruler,
  Search,
  Filter,
  Check,
  X,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCountries,
  useSpecies,
  useDiseases,
  useDenominators,
  useUnits,
  useUpdateMasterDataItem,
  type MasterDataCountry,
  type MasterDataSpecies,
  type MasterDataDisease,
  type MasterDataDenominator,
  type MasterDataUnit,
} from '@/lib/api/hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { TableSkeleton } from '@/components/ui/Skeleton';

type TabKey = 'countries' | 'species' | 'diseases' | 'denominators' | 'units';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'countries', label: 'Countries', icon: <Globe className="h-4 w-4" /> },
  { key: 'species', label: 'Species', icon: <PawPrint className="h-4 w-4" /> },
  { key: 'diseases', label: 'Diseases', icon: <Bug className="h-4 w-4" /> },
  {
    key: 'denominators',
    label: 'Denominators',
    icon: <Calculator className="h-4 w-4" />,
  },
  { key: 'units', label: 'Units', icon: <Ruler className="h-4 w-4" /> },
];

const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'CONTINENTAL_ADMIN',
  'REC_ADMIN',
  'NATIONAL_ADMIN',
];

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('countries');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user && ADMIN_ROLES.includes(user.role);

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    setSearch('');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Data</h1>
          <p className="mt-1 text-sm text-gray-500">
            Geography, species, diseases, units, and referential management
          </p>
        </div>
        {activeTab === 'denominators' && (
          <Link
            href="/master-data/denominators"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            FAOSTAT Comparison
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 pb-2 pt-1 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-aris-primary-600 text-aris-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
        />
      </div>

      {/* Tab content */}
      {activeTab === 'countries' && (
        <CountriesTab search={search} page={page} setPage={setPage} isAdmin={!!isAdmin} />
      )}
      {activeTab === 'species' && (
        <SpeciesTab search={search} page={page} setPage={setPage} isAdmin={!!isAdmin} />
      )}
      {activeTab === 'diseases' && (
        <DiseasesTab search={search} page={page} setPage={setPage} isAdmin={!!isAdmin} />
      )}
      {activeTab === 'denominators' && (
        <DenominatorsTab search={search} page={page} setPage={setPage} isAdmin={!!isAdmin} />
      )}
      {activeTab === 'units' && (
        <UnitsTab search={search} page={page} setPage={setPage} isAdmin={!!isAdmin} />
      )}
    </div>
  );
}

// ─── Shared pagination component ─────────────────────────────────────────────

function Pagination({
  meta,
  page,
  setPage,
}: {
  meta?: { total: number; page: number; limit: number };
  page: number;
  setPage: (p: number) => void;
}) {
  if (!meta || meta.total <= meta.limit) return null;
  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-gray-500">
        Showing {(meta.page - 1) * meta.limit + 1}–
        {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => setPage(page + 1)}
          disabled={page * meta.limit >= meta.total}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ─── Inline edit cell ────────────────────────────────────────────────────────

function InlineEditCell({
  value,
  type,
  id,
  field,
  isAdmin,
}: {
  value: string;
  type: 'countries' | 'species' | 'diseases' | 'denominators' | 'units';
  id: string;
  field: string;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const update = useUpdateMasterDataItem();

  function handleSave() {
    if (editValue !== value) {
      update.mutate({ type, id, payload: { [field]: editValue } });
    }
    setEditing(false);
  }

  function handleCancel() {
    setEditValue(value);
    setEditing(false);
  }

  if (!isAdmin) {
    return <span>{value}</span>;
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-aris-primary-500 focus:outline-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <button
          onClick={handleSave}
          className="rounded p-0.5 text-green-600 hover:bg-green-50"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleCancel}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <span
      className="group flex items-center gap-1 cursor-pointer"
      onClick={() => setEditing(true)}
    >
      {value}
      <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />
    </span>
  );
}

// ─── Countries Tab ───────────────────────────────────────────────────────────

function CountriesTab({
  search,
  page,
  setPage,
  isAdmin,
}: {
  search: string;
  page: number;
  setPage: (p: number) => void;
  isAdmin: boolean;
}) {
  const { data, isLoading } = useCountries({ page, limit: 20, search: search || undefined });
  const countries = data?.data ?? [];

  if (isLoading) return <TableSkeleton rows={10} cols={6} />;

  return (
    <>
      <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">ISO Code</th>
              <th className="px-4 py-3">ISO3</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Sub-Region</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {countries.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <InlineEditCell
                    value={c.name}
                    type="countries"
                    id={c.id}
                    field="name"
                    isAdmin={isAdmin}
                  />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">
                  {c.code}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">
                  {c.iso3}
                </td>
                <td className="px-4 py-3 text-gray-600">{c.region}</td>
                <td className="px-4 py-3 text-gray-600">{c.subRegion}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(c.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {countries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No countries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination meta={data?.meta} page={page} setPage={setPage} />
    </>
  );
}

// ─── Species Tab ─────────────────────────────────────────────────────────────

function SpeciesTab({
  search,
  page,
  setPage,
  isAdmin,
}: {
  search: string;
  page: number;
  setPage: (p: number) => void;
  isAdmin: boolean;
}) {
  const { data, isLoading } = useSpecies({ page, limit: 20, search: search || undefined });
  const species = data?.data ?? [];

  if (isLoading) return <TableSkeleton rows={10} cols={5} />;

  return (
    <>
      <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <th className="px-4 py-3">Common Name</th>
              <th className="px-4 py-3">Scientific Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">WOAH Code</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {species.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <InlineEditCell
                    value={s.name}
                    type="species"
                    id={s.id}
                    field="name"
                    isAdmin={isAdmin}
                  />
                </td>
                <td className="px-4 py-3 italic text-gray-600">
                  {s.scientificName}
                </td>
                <td className="px-4 py-3 text-gray-600">{s.category}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">
                  {s.woahCode}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(s.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {species.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No species found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination meta={data?.meta} page={page} setPage={setPage} />
    </>
  );
}

// ─── Diseases Tab ────────────────────────────────────────────────────────────

function DiseasesTab({
  search,
  page,
  setPage,
  isAdmin,
}: {
  search: string;
  page: number;
  setPage: (p: number) => void;
  isAdmin: boolean;
}) {
  const { data, isLoading } = useDiseases({ page, limit: 20, search: search || undefined });
  const diseases = data?.data ?? [];

  if (isLoading) return <TableSkeleton rows={10} cols={6} />;

  return (
    <>
      <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <th className="px-4 py-3">Disease</th>
              <th className="px-4 py-3">WOAH Code</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Notifiable</th>
              <th className="px-4 py-3">Zoonotic</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {diseases.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <InlineEditCell
                    value={d.name}
                    type="diseases"
                    id={d.id}
                    field="name"
                    isAdmin={isAdmin}
                  />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">
                  {d.woahCode}
                </td>
                <td className="px-4 py-3 text-gray-600">{d.category}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      d.notifiable
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {d.notifiable ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      d.zoonotic
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {d.zoonotic ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(d.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {diseases.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No diseases found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination meta={data?.meta} page={page} setPage={setPage} />
    </>
  );
}

// ─── Denominators Tab ────────────────────────────────────────────────────────

function DenominatorsTab({
  search,
  page,
  setPage,
  isAdmin,
}: {
  search: string;
  page: number;
  setPage: (p: number) => void;
  isAdmin: boolean;
}) {
  const { data, isLoading } = useDenominators({ page, limit: 20, country: search || undefined });
  const denominators = data?.data ?? [];

  if (isLoading) return <TableSkeleton rows={10} cols={7} />;

  return (
    <>
      <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Species</th>
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3">FAOSTAT</th>
              <th className="px-4 py-3">National Census</th>
              <th className="px-4 py-3">Variance</th>
              <th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {denominators.map((d) => {
              const variance = d.variance ?? (
                d.nationalCensusValue && d.faostatValue
                  ? ((d.nationalCensusValue - d.faostatValue) / d.faostatValue) * 100
                  : null
              );

              return (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {d.country}
                    <span className="ml-1 font-mono text-xs text-gray-400">
                      ({d.countryCode})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{d.species}</td>
                  <td className="px-4 py-3 text-gray-600">{d.year}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {d.faostatValue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {d.nationalCensusValue?.toLocaleString() ?? '\u2014'}
                  </td>
                  <td className="px-4 py-3">
                    {variance !== null ? (
                      <span
                        className={cn(
                          'text-xs font-medium',
                          Math.abs(variance) > 20
                            ? 'text-red-600'
                            : Math.abs(variance) > 10
                              ? 'text-amber-600'
                              : 'text-green-600',
                        )}
                      >
                        {variance > 0 ? '+' : ''}
                        {variance.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        d.source === 'FAOSTAT'
                          ? 'bg-blue-100 text-blue-700'
                          : d.source === 'NATIONAL_CENSUS'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700',
                      )}
                    >
                      {d.source.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              );
            })}
            {denominators.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No denominator data found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination meta={data?.meta} page={page} setPage={setPage} />
    </>
  );
}

// ─── Units Tab ───────────────────────────────────────────────────────────────

function UnitsTab({
  search,
  page,
  setPage,
  isAdmin,
}: {
  search: string;
  page: number;
  setPage: (p: number) => void;
  isAdmin: boolean;
}) {
  const { data, isLoading } = useUnits({ page, limit: 20, search: search || undefined });
  const units = data?.data ?? [];

  if (isLoading) return <TableSkeleton rows={10} cols={5} />;

  return (
    <>
      <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">SI Equivalent</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {units.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <InlineEditCell
                    value={u.name}
                    type="units"
                    id={u.id}
                    field="name"
                    isAdmin={isAdmin}
                  />
                </td>
                <td className="px-4 py-3 font-mono text-gray-600">
                  {u.symbol}
                </td>
                <td className="px-4 py-3 text-gray-600">{u.category}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {u.siEquivalent ?? '\u2014'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(u.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {units.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No units found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination meta={data?.meta} page={page} setPage={setPage} />
    </>
  );
}
