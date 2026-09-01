'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  Save,
  Map,
  Search,
  Check,
  ChevronDown,
  BarChart3,
  FileText,
  Users,
  List,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { useSettingsCountry } from '@/lib/api/settings-hooks';
import {
  useGeoZones,
  useCreateGeoZone,
  useUpdateGeoZone,
  useDeleteGeoZone,
  type GeoZone,
} from '@/lib/api/settings-hooks';
import { useGeoEntities, type GeoEntity } from '@/lib/api/geo-hooks';
import { useZoneKpis, type ZoneKpis } from '@/lib/api/analytics-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { MultilingualInput } from '@/components/settings/MultilingualInput';

// ─── Constants ────────────────────────────────────────────────────────────────

const emptyML: Record<string, string> = { en: '', fr: '', pt: '', ar: '', es: '', sw: '' };

const DOMAIN_OPTIONS = [
  { code: 'animal-health', labelKey: 'domainAnimalHealth' },
  { code: 'livestock', labelKey: 'domainLivestock' },
  { code: 'fisheries', labelKey: 'domainFisheries' },
  { code: 'wildlife', labelKey: 'domainWildlife' },
  { code: 'apiculture', labelKey: 'domainApiculture' },
  { code: 'trade-sps', labelKey: 'domainTradeSps' },
  { code: 'governance', labelKey: 'domainGovernance' },
  { code: 'climate-env', labelKey: 'domainClimateEnv' },
  { code: 'knowledge', labelKey: 'domainKnowledge' },
];

// ─── Multi-select combobox for admin divisions ────────────────────────────────

interface MultiSearchComboboxProps {
  options: GeoEntity[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
}

function MultiSearchCombobox({
  options,
  selected,
  onChange,
  placeholder = 'Select...',
  loading = false,
  disabled = false,
}: MultiSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        (o.name?.en ?? '').toLowerCase().includes(q) ||
        (o.name?.fr ?? '').toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q),
    );
  }, [options, search]);

  const selectedEntities = useMemo(
    () => options.filter((o) => selected.includes(o.id)),
    [options, selected],
  );

  const toggle = useCallback(
    (id: string) => {
      if (selected.includes(id)) {
        onChange(selected.filter((s) => s !== id));
      } else {
        onChange([...selected, id]);
      }
    },
    [selected, onChange],
  );

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[2.25rem] w-full flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
      >
        {selectedEntities.length === 0 ? (
          <span className="text-gray-400">{placeholder}</span>
        ) : (
          selectedEntities.map((e) => (
            <span
              key={e.id}
              className="inline-flex items-center gap-1 rounded-full bg-aris-primary-50 px-2 py-0.5 text-xs font-medium text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-400"
            >
              {e.name?.en ?? e.code}
              <button
                type="button"
                className="ml-0.5 hover:text-red-500"
                onClick={(ev) => {
                  ev.stopPropagation();
                  toggle(e.id);
                }}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))
        )}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded border border-gray-200 bg-white py-1.5 pl-8 pr-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {loading ? (
              <li className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-400">No options found</li>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.includes(opt.id);
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => toggle(opt.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? 'border-aris-primary-600 bg-aris-primary-600'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <span className="flex-1 text-left text-gray-900 dark:text-white">
                        {opt.name?.en ?? opt.code}
                      </span>
                      <span className="text-xs text-gray-400">{opt.code}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {selected.length > 0 && (
            <div className="border-t border-gray-100 p-2 dark:border-gray-800">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-red-500 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Zone Form Modal ──────────────────────────────────────────────────────────

interface ZoneFormProps {
  zone?: GeoZone | null;
  countryCode: string;
  admin1Entities: GeoEntity[];
  admin1Loading: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  t: (key: string) => string;
}

function ZoneFormModal({
  zone,
  countryCode,
  admin1Entities,
  admin1Loading,
  onClose,
  onSaved,
  t,
}: ZoneFormProps) {
  const isEdit = !!zone;
  const createMutation = useCreateGeoZone();
  const updateMutation = useUpdateGeoZone();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const [form, setForm] = useState({
    code: zone?.code ?? '',
    name: { ...emptyML, ...(zone?.name ?? {}) },
    description: { ...emptyML, ...(zone?.description ?? {}) },
    domainCode: zone?.domainCode ?? DOMAIN_OPTIONS[0].code,
    memberIds: zone?.memberIds ?? ([] as string[]),
    sortOrder: zone?.sortOrder ?? 0,
    isActive: zone?.isActive ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  // Auto-generate code from English name
  const handleNameChange = (val: Record<string, string>) => {
    setForm((prev) => ({
      ...prev,
      name: val as Record<string, string>,
      code: prev.code || val.en
        ? prev.code
          ? prev.code
          : val.en.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').slice(0, 20)
        : '',
    }));
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.en.trim()) return;
    setError(null);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name,
        description: Object.values(form.description).some(Boolean) ? form.description : undefined,
        domainCode: form.domainCode,
        countryCode,
        memberIds: form.memberIds,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      };
      if (isEdit && zone) {
        await updateMutation.mutateAsync({ id: zone.id, ...payload });
        onSaved(t('zoneSaved'));
      } else {
        await createMutation.mutateAsync(payload);
        onSaved(t('zoneSaved'));
      }
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'An error occurred');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {isEdit ? t('editZone') : t('newZone')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Code + Domain row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('zoneCode')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="AQUA_ZONE_1"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('zoneDomain')} <span className="text-red-500">*</span>
              </label>
              <select
                value={form.domainCode}
                onChange={(e) => setForm((p) => ({ ...p, domainCode: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                {DOMAIN_OPTIONS.map((d) => (
                  <option key={d.code} value={d.code}>
                    {t(d.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Name */}
          <MultilingualInput
            label={`${t('zoneName')} *`}
            value={form.name}
            onChange={(v) => handleNameChange(v as Record<string, string>)}
            required
          />

          {/* Description (optional) */}
          <MultilingualInput
            label={t('zoneDescription')}
            value={form.description}
            onChange={(v) => setForm((p) => ({ ...p, description: v as Record<string, string> }))}
          />

          {/* Member divisions */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('zoneMembers')}
            </label>
            <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">{t('selectAdmin1')}</p>
            <MultiSearchCombobox
              options={admin1Entities}
              selected={form.memberIds}
              onChange={(ids) => setForm((p) => ({ ...p, memberIds: ids }))}
              placeholder={t('selectAdmin1')}
              loading={admin1Loading}
            />
          </div>

          {/* Sort order + Active */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Sort Order
              </label>
              <input
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isActive}
                  onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                    form.isActive ? 'bg-aris-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      form.isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('active')}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <p className="text-xs text-gray-400">
            <span className="text-red-500">*</span> Required
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.code.trim() || !form.name.en.trim() || isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? t('saveChanges') : t('create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Zone KPI Card ────────────────────────────────────────────────────────────

function ZoneKpiCard({
  zone,
  admin1Map,
  domainLabel,
}: {
  zone: GeoZone;
  admin1Map: Map<string, GeoEntity>;
  domainLabel: (code: string) => string;
}) {
  const { data: kpiData, isLoading } = useZoneKpis(zone.id, zone.memberIds);
  const kpis = kpiData?.data;

  const memberNames = zone.memberIds
    .map((id) => admin1Map.get(id)?.name?.en ?? '?')
    .slice(0, 5);
  const moreCount = Math.max(0, zone.memberIds.length - 5);

  // Simple bar chart data
  const breakdown = kpis?.memberBreakdown ?? [];
  const maxCount = Math.max(1, ...breakdown.map((b) => b.count));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{zone.name?.en}</h3>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 mt-1">
            {domainLabel(zone.domainCode)}
          </span>
        </div>
        <span className="font-mono text-xs text-gray-400">{zone.code}</span>
      </div>

      {/* KPI Numbers */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <FileText className="h-3.5 w-3.5" />
            Submissions
          </div>
          <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (kpis?.totalSubmissions ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Users className="h-3.5 w-3.5" />
            Tenants
          </div>
          <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (kpis?.activeTenants ?? 0)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Map className="h-3.5 w-3.5" />
            Regions
          </div>
          <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
            {zone.memberIds.length}
          </p>
        </div>
      </div>

      {/* Member breakdown mini bar chart */}
      {!isLoading && breakdown.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Breakdown by region</p>
          {breakdown.slice(0, 6).map((b) => {
            const name = admin1Map.get(b.admin1Id)?.name?.en ?? b.admin1Id.slice(0, 8);
            const pct = (b.count / maxCount) * 100;
            return (
              <div key={b.admin1Id} className="flex items-center gap-2">
                <span className="w-20 truncate text-xs text-gray-600 dark:text-gray-400" title={name}>
                  {name}
                </span>
                <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-aris-primary-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                  {b.count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Member tags */}
      <div className="mt-3 flex flex-wrap gap-1">
        {memberNames.map((name, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-400"
          >
            {name}
          </span>
        ))}
        {moreCount > 0 && (
          <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            +{moreCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GeoZonesPage() {
  const { id: countryId } = useParams<{ id: string }>();
  const { isSuperAdmin, isContinentalAdmin, isRecAdmin, isNationalAdmin } = useSettingsAccess();
  const t = useTranslations('settings');
  const canEdit = isSuperAdmin || isContinentalAdmin || isRecAdmin || isNationalAdmin;

  // Country info
  const { data: countryData, isLoading: countryLoading } = useSettingsCountry(countryId);
  const country = countryData?.data as Record<string, any> | undefined;
  const countryCode = country?.code ?? '';

  // View mode: list or dashboard
  const [viewMode, setViewMode] = useState<'list' | 'dashboard'>('list');

  // Domain filter
  const [domainFilter, setDomainFilter] = useState('');

  // Zones data
  const { data: zonesData, isLoading: zonesLoading } = useGeoZones({
    countryCode: countryCode || undefined,
    domainCode: domainFilter || undefined,
  });
  const zones: GeoZone[] = zonesData?.data ?? [];

  // Admin1 entities for member picker
  const { data: admin1Data, isLoading: admin1Loading } = useGeoEntities(
    countryCode ? { countryCode, level: 'ADMIN1', limit: 500 } : undefined,
  );
  const admin1Entities: GeoEntity[] = useMemo(() => admin1Data?.data ?? [], [admin1Data]);

  // Build a lookup map: id → GeoEntity
  const admin1Map = useMemo(() => {
    const map = new Map<string, GeoEntity>();
    for (const e of admin1Entities) map.set(e.id, e);
    return map;
  }, [admin1Entities]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<GeoZone | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteMutation = useDeleteGeoZone();

  // Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const openCreate = () => {
    setEditingZone(null);
    setModalOpen(true);
  };

  const openEdit = (zone: GeoZone) => {
    setEditingZone(zone);
    setModalOpen(true);
  };

  const handleSaved = (message: string) => {
    setToast({ type: 'success', message });
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      setToast({ type: 'success', message: t('zoneDeleted') });
      setDeletingId(null);
    } catch {
      setToast({ type: 'error', message: 'Failed to delete zone' });
      setDeletingId(null);
    }
  };

  const deletingZone = zones.find((z) => z.id === deletingId);

  // Domain label helper
  const domainLabel = (code: string) => {
    const opt = DOMAIN_OPTIONS.find((d) => d.code === code);
    return opt ? t(opt.labelKey) : code;
  };

  // Member names for tooltip
  const memberNames = (memberIds: string[]) =>
    memberIds
      .map((id) => admin1Map.get(id)?.name?.en ?? id)
      .join(', ');

  if (countryLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/settings/countries/${countryId}`}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            {country?.flag && <span className="text-2xl">{country.flag}</span>}
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {t('geoZones')}
                {country?.name?.en ? ` — ${country.name.en}` : ''}
              </h1>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {t('geoZonesDesc')}
              </p>
            </div>
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            {t('newZone')}
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">{t('allDomainsFilter')}</option>
          {DOMAIN_OPTIONS.map((d) => (
            <option key={d.code} value={d.code}>
              {t(d.labelKey)}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-400">
          {zones.length} {zones.length === 1 ? 'zone' : 'zones'}
        </span>
        <div className="ml-auto flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-aris-primary-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            {t('listView') || 'List'}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'dashboard'
                ? 'bg-aris-primary-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Dashboard
          </button>
        </div>
      </div>

      {/* Dashboard View */}
      {viewMode === 'dashboard' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {zonesLoading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : zones.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12">
              <Map className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-400 dark:text-gray-500">{t('noZonesYet')}</p>
            </div>
          ) : (
            zones.map((zone) => (
              <ZoneKpiCard
                key={zone.id}
                zone={zone}
                admin1Map={admin1Map}
                domainLabel={domainLabel}
              />
            ))
          )}
        </div>
      )}

      {/* Table (List View) */}
      {viewMode === 'list' && <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('zoneCode')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('zoneName')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('zoneDomain')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('zoneMembers')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('active')}</th>
                {canEdit && (
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('colActions')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {zonesLoading ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                  </td>
                </tr>
              ) : zones.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="py-12 text-center">
                    <Map className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {t('noZonesYet')}
                    </p>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={openCreate}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-aris-primary-400 hover:text-aris-primary-600 dark:border-gray-600 dark:text-gray-400"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t('newZone')}
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                zones.map((zone) => (
                  <tr key={zone.id} className="group hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {zone.code}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                      {zone.name?.en || <span className="text-gray-300">—</span>}
                      {zone.name?.fr && zone.name.fr !== zone.name.en && (
                        <span className="ml-1.5 text-xs text-gray-400">/ {zone.name.fr}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {domainLabel(zone.domainCode)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {zone.memberIds && zone.memberIds.length > 0 ? (
                        <span
                          title={memberNames(zone.memberIds)}
                          className="cursor-help text-sm text-gray-700 dark:text-gray-300"
                        >
                          {zone.memberIds.length} {zone.memberIds.length === 1 ? 'region' : 'regions'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${
                          zone.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      />
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => openEdit(zone)}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                            title={t('edit')}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(zone.id)}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                            title={t('delete')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <ZoneFormModal
          zone={editingZone}
          countryCode={countryCode}
          admin1Entities={admin1Entities}
          admin1Loading={admin1Loading}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          t={t}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && deletingZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Delete zone
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete zone <strong>{deletingZone.code}</strong>{' '}
                  ({deletingZone.name?.en})? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 rounded p-0.5 hover:bg-white/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
