'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Loader2,
  Search,
  Pencil,
  X,
  Save,
  MapPin,
  ChevronRight,
  Globe,
  Hash,
} from 'lucide-react';
import { useSettingsCountry, useAdminLevels, type AdminLevel } from '@/lib/api/settings-hooks';
import {
  useGeoEntities,
  useCreateGeoEntity,
  useUpdateGeoEntity,
  type GeoEntity,
} from '@/lib/api/geo-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { Pagination } from '@/components/ui/Pagination';
import { GeoLocationPicker } from '@/components/geo/GeoLocationPicker';
import { MultilingualInput } from '@/components/settings/MultilingualInput';

const emptyML: Record<string, string> = { en: '', fr: '', pt: '', ar: '' };

export default function DivisionsPage() {
  const { id: countryId } = useParams<{ id: string }>();
  const { isSuperAdmin, isContinentalAdmin } = useSettingsAccess();
  const canEdit = isSuperAdmin || isContinentalAdmin;

  // Country info
  const { data: countryData, isLoading: countryLoading } = useSettingsCountry(countryId);
  const country = countryData?.data as Record<string, any> | undefined;
  const countryCode = country?.code ?? '';

  // Admin levels
  const { data: adminLevelsData } = useAdminLevels(countryId, countryCode || undefined);
  const adminLevels: AdminLevel[] = useMemo(() => {
    const levels = (adminLevelsData?.data ?? []) as AdminLevel[];
    return [...levels].sort((a, b) => a.level - b.level);
  }, [adminLevelsData]);

  const levelOptions = useMemo(
    () => ['ALL', ...adminLevels.map((al) => `ADMIN${al.level}`)],
    [adminLevels],
  );

  // View state
  const [view, setView] = useState<'list' | 'form'>('list');

  // Filters
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [parentFilter, setParentFilter] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Debounce search
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  }, []);

  // Query params
  const queryParams = useMemo(() => {
    const params: Record<string, any> = { countryCode, page, limit };
    if (levelFilter !== 'ALL') params.level = levelFilter;
    if (parentFilter) params.parentId = parentFilter;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [countryCode, levelFilter, parentFilter, debouncedSearch, page, limit]);

  const { data: geoData, isLoading: geoLoading } = useGeoEntities(
    countryCode ? queryParams : undefined,
  );
  const geoEntities: GeoEntity[] = geoData?.data ?? [];
  const total = geoData?.meta?.total ?? 0;

  // Form state
  const [dialogForm, setDialogForm] = useState({
    id: '',
    code: '',
    name: { ...emptyML },
    level: adminLevels[0] ? `ADMIN${adminLevels[0].level}` : 'ADMIN1',
    parentId: undefined as string | undefined,
    latitude: '',
    longitude: '',
  });
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');

  const createMutation = useCreateGeoEntity();
  const updateMutation = useUpdateGeoEntity();

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openAdd = () => {
    setDialogForm({
      id: '',
      code: '',
      name: { ...emptyML },
      level: adminLevels[0] ? `ADMIN${adminLevels[0].level}` : 'ADMIN1',
      parentId: undefined,
      latitude: '',
      longitude: '',
    });
    setFormMode('add');
    setView('form');
  };

  const openEdit = (entity: GeoEntity) => {
    setDialogForm({
      id: entity.id,
      code: entity.code,
      name: { ...emptyML, ...(entity.name ?? {}) },
      level: entity.level,
      parentId: entity.parentId ?? undefined,
      latitude: entity.latitude != null ? String(entity.latitude) : '',
      longitude: entity.longitude != null ? String(entity.longitude) : '',
    });
    setFormMode('edit');
    setView('form');
  };

  const handleBack = () => setView('list');

  const handleSave = async () => {
    if (!dialogForm.code.trim() || !dialogForm.name.en.trim()) return;

    try {
      if (formMode === 'add') {
        await createMutation.mutateAsync({
          code: dialogForm.code.trim(),
          name: dialogForm.name,
          level: dialogForm.level,
          countryCode,
          parentId: dialogForm.parentId,
          latitude: dialogForm.latitude ? parseFloat(dialogForm.latitude) : undefined,
          longitude: dialogForm.longitude ? parseFloat(dialogForm.longitude) : undefined,
        });
        setToast({ type: 'success', message: 'Division created successfully' });
      } else {
        await updateMutation.mutateAsync({
          id: dialogForm.id,
          code: dialogForm.code.trim(),
          name: dialogForm.name,
          latitude: dialogForm.latitude ? parseFloat(dialogForm.latitude) : undefined,
          longitude: dialogForm.longitude ? parseFloat(dialogForm.longitude) : undefined,
        });
        setToast({ type: 'success', message: 'Division updated successfully' });
      }
      setView('list');
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message ?? 'Operation failed' });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Helpers
  const levelLabel = (lvl: string) =>
    adminLevels.find((al) => `ADMIN${al.level}` === lvl)?.name?.en ?? lvl;

  const dialogLevelNum = parseInt(dialogForm.level.replace('ADMIN', ''), 10);
  const dialogParentMaxLevel = dialogLevelNum > 1 ? dialogLevelNum - 1 : 0;

  const levelBreadcrumb = adminLevels.map((al) => al.name?.en ?? `Level ${al.level}`);

  if (countryLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (view === 'form') {
    return (
      <div className="space-y-5 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/settings/countries/${countryId}`}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {country?.flag} {formMode === 'add' ? 'Add Division' : 'Edit Division'}
              </h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {formMode === 'add'
                  ? `Create a new geographic division for ${country?.name?.en ?? 'this country'}`
                  : `Editing: ${dialogForm.name.en || dialogForm.code}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        {/* Inline form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {/* Level */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Level <span className="text-red-500">*</span>
              </label>
              <select
                value={dialogForm.level}
                onChange={(e) =>
                  setDialogForm((p) => ({
                    ...p,
                    level: e.target.value,
                    parentId: undefined,
                  }))
                }
                disabled={formMode === 'edit'}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adminLevels.map((al) => (
                  <option key={al.level} value={`ADMIN${al.level}`}>
                    L{al.level} — {al.name?.en ?? `Level ${al.level}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Code */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" />
                  Code <span className="text-red-500">*</span>
                </span>
              </label>
              <input
                type="text"
                value={dialogForm.code}
                onChange={(e) =>
                  setDialogForm((p) => ({ ...p, code: e.target.value }))
                }
                placeholder="KE-001"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Parent picker (for level 2+) */}
          {formMode === 'add' && dialogParentMaxLevel > 0 && countryCode && (
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Parent Division <span className="text-red-500">*</span>
              </label>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/50">
                <GeoLocationPicker
                  countryCode={countryCode}
                  countryId={countryId}
                  maxLevel={dialogParentMaxLevel}
                  onChange={(entityId) =>
                    setDialogForm((p) => ({
                      ...p,
                      parentId: entityId ?? undefined,
                    }))
                  }
                />
              </div>
            </div>
          )}

          {/* Multilingual Name */}
          <div className="mt-4">
            <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Globe className="h-3.5 w-3.5" />
              Division Name <span className="text-red-500">*</span>
            </div>
            <MultilingualInput
              label=""
              value={dialogForm.name}
              onChange={(val) =>
                setDialogForm((p) => ({ ...p, name: val as Record<string, string> }))
              }
              required
              placeholder="Enter division name..."
            />
          </div>

          {/* Coordinates */}
          <div className="mt-4">
            <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              Coordinates <span className="text-xs font-normal text-gray-400">(optional)</span>
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={dialogForm.latitude}
                  onChange={(e) =>
                    setDialogForm((p) => ({ ...p, latitude: e.target.value }))
                  }
                  placeholder="-1.2921"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={dialogForm.longitude}
                  onChange={(e) =>
                    setDialogForm((p) => ({ ...p, longitude: e.target.value }))
                  }
                  placeholder="36.8219"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-4">
            <p className="text-xs text-gray-400">
              <span className="text-red-500">*</span> Required fields
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={isSaving}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!dialogForm.code.trim() || !dialogForm.name.en.trim() || isSaving}
                className="flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-aris-primary-700 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {formMode === 'add' ? 'Create' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
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

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/settings/countries/${countryId}`}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {country?.flag} {country?.name?.en ?? 'Country'} — Divisions
            </h1>
            {levelBreadcrumb.length > 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <MapPin className="h-3 w-3" />
                {levelBreadcrumb.map((name, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronRight className="h-3 w-3" />}
                    <span>{name}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            Add Division
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900/50">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Total: <span className="font-semibold text-gray-900 dark:text-white">{total}</span> divisions
        </span>
        {adminLevels.map((al) => (
          <span key={al.level} className="text-xs text-gray-400 dark:text-gray-500">
            L{al.level} {al.name?.en}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or code..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={levelFilter}
          onChange={(e) => {
            setLevelFilter(e.target.value);
            setParentFilter(undefined);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          {levelOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt === 'ALL' ? 'All Levels' : levelLabel(opt)}
            </option>
          ))}
        </select>
      </div>

      {/* Parent filter */}
      {levelFilter !== 'ALL' &&
        parseInt(levelFilter.replace('ADMIN', ''), 10) > 1 &&
        countryCode && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/50">
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              Filter by parent:
            </p>
            <GeoLocationPicker
              countryCode={countryCode}
              countryId={countryId}
              maxLevel={parseInt(levelFilter.replace('ADMIN', ''), 10) - 1}
              onChange={(entityId) => {
                setParentFilter(entityId ?? undefined);
                setPage(1);
              }}
            />
          </div>
        )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Code</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name (EN)</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name (FR)</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name (PT)</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  <span dir="rtl">Name (AR)</span>
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Level</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Parent</th>
                {canEdit && (
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-16">Edit</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {geoLoading ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                  </td>
                </tr>
              ) : geoEntities.length === 0 ? (
                <tr>
                  <td
                    colSpan={canEdit ? 8 : 7}
                    className="py-10 text-center text-sm text-gray-400"
                  >
                    <MapPin className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
                    No divisions found.
                    {canEdit && ' Click "Add Division" to create one.'}
                  </td>
                </tr>
              ) : (
                geoEntities.map((entity) => (
                  <tr
                    key={entity.id}
                    className="group hover:bg-gray-50 dark:hover:bg-gray-900/30"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {entity.code}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                      {entity.name?.en || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                      {entity.name?.fr || <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                      {entity.name?.pt || <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400" dir="rtl">
                      {entity.name?.ar || <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-aris-primary-50 px-2 py-0.5 text-xs font-medium text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-400">
                        {levelLabel(entity.level)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                      {entity.parentName?.en || <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => openEdit(entity)}
                          className="rounded p-1.5 text-gray-400 opacity-0 transition-all hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100 dark:hover:bg-gray-800 dark:hover:text-white"
                          title="Edit division"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <Pagination
            page={page}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
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
