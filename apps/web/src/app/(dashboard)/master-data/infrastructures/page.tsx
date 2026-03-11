'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2, Plus, Search, X, ChevronDown, Pencil, Trash2,
  Loader2, MapPin, Phone, Hash, ChevronLeft, ChevronRight,
  Navigation, ArrowLeft, Maximize2, Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  useTenantStore,
  deriveCountryCodeFromEmail,
  findParentRec,
} from '@/lib/stores/tenant-store';
import { COUNTRIES } from '@/data/countries-config';
import { RECS } from '@/data/recs-config';
import { GeoLocationPicker } from '@/components/geo/GeoLocationPicker';
import { GeoPointMap } from '@/components/form-builder/renderer/GeoPointMap';
import { GeoPolygonMap } from '@/components/form-builder/renderer/GeoPolygonMap';
import { useGeoEntities, type GeoEntity } from '@/lib/api/geo-hooks';
import {
  useRefDataList,
  useCreateRefData,
  useUpdateRefData,
  useDeleteRefData,
  type RefDataItem,
} from '@/lib/api/ref-data-hooks';

// ── Infrastructure categories ────────────────────────────────────────────────

interface InfraSubType { value: string; en: string; fr: string; }
interface InfraCategory { value: string; en: string; fr: string; subTypes: InfraSubType[]; }

const INFRASTRUCTURE_CATEGORIES: InfraCategory[] = [
  { value: 'laboratory', en: 'Laboratory', fr: 'Laboratoire', subTypes: [
    { value: 'veterinary', en: 'Veterinary Laboratory', fr: 'Laboratoire vétérinaire' },
    { value: 'research', en: 'Research Laboratory', fr: 'Laboratoire de recherche' },
    { value: 'diagnostic', en: 'Diagnostic Laboratory', fr: 'Laboratoire de diagnostic' },
  ]},
  { value: 'slaughterhouse', en: 'Slaughterhouse', fr: 'Abattoir', subTypes: [
    { value: 'industrial', en: 'Industrial Slaughterhouse', fr: 'Abattoir industriel' },
    { value: 'municipal', en: 'Municipal Slaughterhouse', fr: 'Abattoir municipal' },
    { value: 'slaughter_area', en: 'Slaughter Area', fr: "Aire d'abattage" },
  ]},
  { value: 'market', en: 'Market', fr: 'Marché', subTypes: [
    { value: 'livestock', en: 'Livestock Market', fr: 'Marché à bétail' },
    { value: 'fish', en: 'Fish Market', fr: 'Marché de poisson' },
    { value: 'terminal', en: 'Terminal Market', fr: 'Marché terminal' },
  ]},
  { value: 'storage', en: 'Storage', fr: 'Entreposage', subTypes: [
    { value: 'cold_storage', en: 'Cold Storage', fr: 'Entrepôt frigorifique' },
    { value: 'warehouse', en: 'Warehouse', fr: 'Entrepôt de stockage' },
    { value: 'cold_room', en: 'Cold Room', fr: 'Chambre froide' },
  ]},
  { value: 'checkpoint', en: 'Checkpoint / Control Post', fr: 'Poste de contrôle', subTypes: [
    { value: 'border_inspection', en: 'Border Inspection Post', fr: "Poste d'inspection frontalier" },
    { value: 'quarantine', en: 'Quarantine Station', fr: 'Poste de quarantaine' },
    { value: 'veterinary_control', en: 'Veterinary Control Post', fr: 'Poste de contrôle vétérinaire' },
  ]},
  { value: 'port_airport', en: 'Port / Airport', fr: 'Port / Aéroport', subTypes: [
    { value: 'seaport', en: 'Seaport', fr: 'Port maritime' },
    { value: 'fishing_port', en: 'Fishing Port', fr: 'Port de pêche' },
    { value: 'airport', en: 'Airport', fr: 'Aéroport' },
  ]},
  { value: 'training_center', en: 'Training / Education Center', fr: 'Centre de formation', subTypes: [
    { value: 'agricultural_training', en: 'Agricultural Training Center', fr: 'Centre de formation agricole' },
    { value: 'veterinary_school', en: 'Veterinary School', fr: 'École vétérinaire' },
    { value: 'research_center', en: 'Research Center', fr: 'Centre de recherche' },
  ]},
  { value: 'breeding_station', en: 'Breeding / Livestock Station', fr: "Station d'élevage", subTypes: [
    { value: 'seed_farm', en: 'Seed Farm', fr: 'Ferme semencière' },
    { value: 'breeding_station', en: 'Breeding Station', fr: "Station d'élevage" },
    { value: 'ranch', en: 'Ranch', fr: 'Ranch' },
  ]},
  { value: 'collection_center', en: 'Collection / Packaging Center', fr: 'Centre de collecte', subTypes: [
    { value: 'milk_collection', en: 'Milk Collection Center', fr: 'Centre de collecte de lait' },
    { value: 'honey_collection', en: 'Honey Collection Center', fr: 'Centre de collecte de miel' },
    { value: 'packaging', en: 'Packaging Center', fr: 'Centre de conditionnement' },
  ]},
  { value: 'protected_area', en: 'Park / Reserve', fr: 'Parc / Réserve', subTypes: [
    { value: 'national_park', en: 'National Park', fr: 'Parc national' },
    { value: 'nature_reserve', en: 'Nature Reserve', fr: 'Réserve naturelle' },
    { value: 'conservation_area', en: 'Conservation Area', fr: 'Zone de conservation' },
  ]},
  { value: 'industry', en: 'Processing Industry', fr: 'Industrie de transformation', subTypes: [
    { value: 'tannery', en: 'Tannery', fr: 'Tannerie' },
    { value: 'dairy', en: 'Dairy', fr: 'Laiterie' },
    { value: 'processing_plant', en: 'Processing Plant', fr: 'Usine de transformation' },
  ]},
  { value: 'water_infrastructure', en: 'Water Infrastructure', fr: 'Infrastructure hydraulique', subTypes: [
    { value: 'water_point', en: 'Water Point', fr: "Point d'eau" },
    { value: 'pastoral_dam', en: 'Pastoral Dam', fr: 'Barrage pastoral' },
    { value: 'borehole', en: 'Borehole', fr: 'Forage' },
  ]},
  { value: 'veterinary_center', en: 'Veterinary Center', fr: 'Centre vétérinaire', subTypes: [
    { value: 'veterinary_clinic', en: 'Veterinary Clinic', fr: 'Clinique vétérinaire' },
    { value: 'veterinary_pharmacy', en: 'Veterinary Pharmacy', fr: 'Pharmacie vétérinaire' },
    { value: 'veterinary_post', en: 'Veterinary Post', fr: 'Poste vétérinaire' },
  ]},
  { value: 'admin_office', en: 'Administrative Office', fr: 'Bureau administratif', subTypes: [
    { value: 'veterinary_directorate', en: 'Veterinary Directorate', fr: 'Direction des services vétérinaires' },
    { value: 'regional_office', en: 'Regional Office', fr: 'Bureau régional' },
    { value: 'district_office', en: 'District Office', fr: 'Bureau de district' },
  ]},
  { value: 'other', en: 'Other', fr: 'Autre', subTypes: [
    { value: 'hatchery', en: 'Hatchery', fr: 'Couvoir' },
    { value: 'teaching_apiary', en: 'Teaching Apiary', fr: 'Rucher école' },
    { value: 'free_zone', en: 'Free Zone', fr: 'Zone franche' },
  ]},
];

const STATUS_OPTIONS = [
  { value: 'operational', en: 'Operational', fr: 'Opérationnel' },
  { value: 'under_construction', en: 'Under Construction', fr: 'En construction' },
  { value: 'planned', en: 'Planned', fr: 'Planifié' },
  { value: 'closed', en: 'Closed', fr: 'Fermé' },
  { value: 'renovating', en: 'Renovating', fr: 'En rénovation' },
];

type GeoMode = 'point' | 'line' | 'polygon';

// ── Country centroid fallback (approximate) ──────────────────────────────────
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  DZ:[28.0,-2.0],AO:[-12.3,17.5],BJ:[9.3,2.3],BW:[-22.3,24.7],BF:[12.3,-1.6],BI:[-3.4,29.9],
  CV:[15.1,-23.6],CM:[5.9,12.7],CF:[6.6,20.9],TD:[15.4,18.7],KM:[-12.2,44.3],CG:[-0.2,15.8],
  CD:[-4.0,21.8],CI:[7.5,-5.5],DJ:[11.6,43.1],EG:[26.8,30.8],GQ:[1.7,10.3],ER:[15.2,39.8],
  SZ:[-26.5,31.5],ET:[9.0,38.7],GA:[-0.8,11.6],GM:[13.4,-16.6],GH:[7.9,-1.0],GN:[9.9,-12.0],
  GW:[12.0,-15.2],KE:[-1.3,36.8],LS:[-29.6,28.2],LR:[6.4,-9.4],LY:[26.3,17.2],MG:[-18.9,46.9],
  MW:[-13.3,34.3],ML:[17.6,-4.0],MR:[21.0,-10.9],MU:[-20.3,57.6],MZ:[-18.7,35.5],NA:[-22.6,17.1],
  NE:[17.6,8.1],NG:[9.1,8.7],RW:[-2.0,29.9],ST:[0.2,6.6],SN:[14.5,-14.5],SC:[-4.7,55.5],
  SL:[8.5,-11.8],SO:[5.2,46.2],ZA:[-30.6,22.9],SS:[6.9,31.3],SD:[12.9,30.2],TZ:[-6.4,34.9],
  TG:[8.6,1.2],TN:[34.0,9.5],UG:[1.4,32.3],ZM:[-13.1,27.8],ZW:[-19.0,29.2],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryLabel(v: string) { return INFRASTRUCTURE_CATEGORIES.find((c) => c.value === v)?.en ?? v; }
function getSubTypeLabel(cat: string, sub: string) { const c = INFRASTRUCTURE_CATEGORIES.find((c) => c.value === cat); return c?.subTypes.find((s) => s.value === sub)?.en ?? sub; }
function getStatusLabel(v: string) { return STATUS_OPTIONS.find((s) => s.value === v)?.en ?? v; }
function getStatusColor(v: string) {
  switch (v) {
    case 'operational': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400';
    case 'under_construction': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
    case 'planned': return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
    case 'closed': return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400';
    case 'renovating': return 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400';
    default: return 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
}

/** Get scoped country list based on user tenant level */
function useScopedCountries() {
  const user = useAuthStore((s) => s.user);
  const selectedTenant = useTenantStore((s) => s.selectedTenant);
  const tenantTree = useTenantStore((s) => s.tenantTree);

  return useMemo(() => {
    const tenantLevel = user?.tenantLevel ?? selectedTenant?.level;
    const userCountryCode = deriveCountryCodeFromEmail(user?.email);

    if (tenantLevel === 'MEMBER_STATE' || (!tenantLevel && userCountryCode)) {
      const cc = userCountryCode ?? selectedTenant?.code;
      if (cc && COUNTRIES[cc]) return { countries: [COUNTRIES[cc]], locked: true, defaultCode: cc };
    }

    if (tenantLevel === 'REC') {
      const recCode = selectedTenant?.code?.toLowerCase();
      const rec = recCode ? RECS[recCode] : null;
      if (rec) {
        const list = rec.countryCodes.map((cc) => COUNTRIES[cc]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
        return { countries: list, locked: false, defaultCode: null as string | null };
      }
      if (selectedTenant?.id) {
        const recNode = findParentRec(tenantTree, selectedTenant.id) ?? selectedTenant;
        if (recNode?.level === 'REC' && recNode.children) {
          const filtered = recNode.children.map((c) => COUNTRIES[c.code]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
          if (filtered.length > 0) return { countries: filtered, locked: false, defaultCode: null as string | null };
        }
      }
    }

    return { countries: Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name)), locked: false, defaultCode: null as string | null };
  }, [user, selectedTenant, tenantTree]);
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN'];
const ITEMS_PER_PAGE = 20;

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — toggles between list view and inline form view
// ══════════════════════════════════════════════════════════════════════════════

export default function InfrastructuresDataPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = user && ADMIN_ROLES.includes(user.role);

  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingItem, setEditingItem] = useState<RefDataItem | null>(null);

  const handleCreate = () => { setEditingItem(null); setView('form'); };
  const handleEdit = (item: RefDataItem) => { setEditingItem(item); setView('form'); };
  const handleBack = () => { setView('list'); setEditingItem(null); };

  if (view === 'form') {
    return (
      <InfrastructureForm
        item={editingItem}
        onBack={handleBack}
      />
    );
  }

  return (
    <InfrastructureList
      canEdit={!!canEdit}
      onCreate={handleCreate}
      onEdit={handleEdit}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LIST VIEW
// ══════════════════════════════════════════════════════════════════════════════

function InfrastructureList({ canEdit, onCreate, onEdit }: {
  canEdit: boolean;
  onCreate: () => void;
  onEdit: (item: RefDataItem) => void;
}) {
  const { countries: scopedCountries } = useScopedCountries();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const searchTimeout = React.useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 300);
  }, []);

  const { data: listData, isLoading } = useRefDataList('infrastructures', {
    page, limit: ITEMS_PER_PAGE,
    search: debouncedSearch || undefined,
    category: filterCategory || undefined,
    countryCode: filterCountry || undefined,
    status: filterStatus || undefined,
    scope: 'national',
  });

  const deleteMutation = useDeleteRefData('infrastructures');
  const items = listData?.data ?? [];
  const total = listData?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const handleDelete = async (item: RefDataItem) => {
    if (!confirm(`Delete "${item.name?.en ?? item.code}"?`)) return;
    await deleteMutation.mutateAsync(item.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/master-data" className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
            <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Infrastructures & Institutions</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Register and manage infrastructure across member states</p>
          </div>
          <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">{total} total</span>
        </div>
        {canEdit && (
          <button onClick={onCreate} className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 transition-colors">
            <Plus className="h-4 w-4" /> Add Infrastructure
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search by name or code..." value={search} onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-aris-primary-500" />
          {search && <button onClick={() => handleSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" /></button>}
        </div>
        <FilterSelect value={filterCategory} onChange={(v) => { setFilterCategory(v); setPage(1); }} placeholder="All Categories" options={INFRASTRUCTURE_CATEGORIES.map((c) => ({ value: c.value, label: c.en }))} />
        <FilterSelect value={filterCountry} onChange={(v) => { setFilterCountry(v); setPage(1); }} placeholder="All Countries" options={scopedCountries.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` }))} />
        <FilterSelect value={filterStatus} onChange={(v) => { setFilterStatus(v); setPage(1); }} placeholder="All Statuses" options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.en }))} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              {['Code','Name','Category','Type','Country','Status','Capacity'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{h}</th>
              ))}
              {canEdit && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              <tr><td colSpan={canEdit ? 8 : 7} className="px-4 py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={canEdit ? 8 : 7} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">No infrastructure registered yet.</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{item.code}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-white">{item.name?.en ?? '—'}</div>
                  {item.name?.fr && <div className="text-xs text-gray-400 dark:text-gray-500">{item.name.fr}</div>}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{getCategoryLabel(item.category ?? '')}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{getSubTypeLabel(item.category ?? '', item.subType ?? '')}</td>
                <td className="px-4 py-3">{item.countryCode ? <span className="text-gray-600 dark:text-gray-300">{COUNTRIES[item.countryCode]?.flag ?? ''} {item.countryCode}</span> : '—'}</td>
                <td className="px-4 py-3"><span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', getStatusColor(item.status ?? 'operational'))}>{getStatusLabel(item.status ?? 'operational')}</span></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.capacity ?? '—'}</td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onEdit(item)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(item)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INLINE FORM VIEW (replaces modal)
// ══════════════════════════════════════════════════════════════════════════════

function InfrastructureForm({ item, onBack }: { item: RefDataItem | null; onBack: () => void }) {
  const isEdit = !!item;
  const { countries: scopedCountries, locked: countryLocked, defaultCode: defaultCountryCode } = useScopedCountries();

  const createMutation = useCreateRefData('infrastructures');
  const updateMutation = useUpdateRefData('infrastructures');
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Form state ──
  const [code, setCode] = useState(item?.code ?? '');
  const [nameEn, setNameEn] = useState(item?.name?.en ?? '');
  const [nameFr, setNameFr] = useState(item?.name?.fr ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [subType, setSubType] = useState(item?.subType ?? '');
  const [year, setYear] = useState(item?.year?.toString() ?? '');
  const [yearEstablished, setYearEstablished] = useState(item?.yearEstablished?.toString() ?? '');
  const [countryCode, setCountryCode] = useState(item?.countryCode ?? defaultCountryCode ?? '');
  const [locationName, setLocationName] = useState(item?.locationName ?? '');
  const [abbreviation, setAbbreviation] = useState(item?.abbreviation ?? '');
  const [quantity, setQuantity] = useState(item?.quantity?.toString() ?? '');
  const [capacity, setCapacity] = useState(item?.capacity?.toString() ?? '');
  const [contactPerson, setContactPerson] = useState(item?.contactPerson ?? '');
  const [address, setAddress] = useState(item?.address ?? '');
  const [email, setEmail] = useState(item?.email ?? '');
  const [telephone, setTelephone] = useState(item?.telephone ?? '');
  const [status, setStatus] = useState(item?.status ?? 'operational');
  const [comment, setComment] = useState(item?.comment ?? '');

  // ── Admin division ──
  const [selectedGeoEntity, setSelectedGeoEntity] = useState<GeoEntity | null>(null);

  // ── GPS / Geometry ──
  const [geoMode, setGeoMode] = useState<GeoMode>('point');
  const initPoint = (item?.latitude != null && item?.longitude != null) ? { lat: item.latitude!, lng: item.longitude! } : null;
  const [geoPoint, setGeoPoint] = useState<{ lat: number; lng: number } | null>(initPoint);
  const initGeometry = (item?.metadata as any)?.geometry ?? null;
  const [geoShape, setGeoShape] = useState<Array<[number, number]> | null>(initGeometry);

  // ── Map center: follows country → admin1 → admin2 → ... ──
  const { data: countryGeoData } = useGeoEntities(
    countryCode ? { level: 'COUNTRY', countryCode, limit: 1 } : undefined,
  );
  const countryGeoEntity = countryGeoData?.data?.[0] ?? null;

  // Compute map center from deepest available geo entity
  const mapCenter = useMemo<{ lat: number; lng: number }>(() => {
    // Priority: selected admin entity > country geo entity > country centroid fallback
    if (selectedGeoEntity?.latitude && selectedGeoEntity?.longitude) {
      return { lat: selectedGeoEntity.latitude, lng: selectedGeoEntity.longitude };
    }
    if (countryGeoEntity?.latitude && countryGeoEntity?.longitude) {
      return { lat: countryGeoEntity.latitude, lng: countryGeoEntity.longitude };
    }
    const fallback = countryCode ? COUNTRY_CENTROIDS[countryCode] : null;
    if (fallback) return { lat: fallback[0], lng: fallback[1] };
    return { lat: 0, lng: 20 }; // Africa center
  }, [selectedGeoEntity, countryGeoEntity, countryCode]);

  // When map center changes, update point map if no point selected yet
  useEffect(() => {
    // Don't overwrite an already-placed point
  }, [mapCenter]);

  const selectedCategory = INFRASTRUCTURE_CATEGORIES.find((c) => c.value === category);
  const availableSubTypes = selectedCategory?.subTypes ?? [];

  const handleCategoryChange = (val: string) => { setCategory(val); setSubType(''); };
  const handleCountryChange = (val: string) => { setCountryCode(val); setSelectedGeoEntity(null); };

  const handleGeoPickerChange = useCallback((entityId: string | null, entity?: GeoEntity) => {
    setSelectedGeoEntity(entity ?? null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !nameEn || !category || !subType || !countryCode) return;

    const data: Record<string, any> = {
      code, name: { en: nameEn, fr: nameFr || nameEn }, category, subType, status, scope: 'national', countryCode,
    };
    if (year) data.year = parseInt(year, 10);
    if (yearEstablished) data.yearEstablished = parseInt(yearEstablished, 10);
    if (locationName) data.locationName = locationName;
    if (abbreviation) data.abbreviation = abbreviation;
    if (quantity) data.quantity = parseInt(quantity, 10);
    if (capacity) data.capacity = parseInt(capacity, 10);
    if (contactPerson) data.contactPerson = contactPerson;
    if (address) data.address = address;
    if (email) data.email = email;
    if (telephone) data.telephone = telephone;
    if (comment) data.comment = comment;

    if (geoMode === 'point' && geoPoint) {
      data.latitude = geoPoint.lat;
      data.longitude = geoPoint.lng;
      data.metadata = { geoType: 'point' };
    } else if ((geoMode === 'line' || geoMode === 'polygon') && geoShape?.length) {
      const centLat = geoShape.reduce((s, p) => s + p[0], 0) / geoShape.length;
      const centLng = geoShape.reduce((s, p) => s + p[1], 0) / geoShape.length;
      data.latitude = centLat;
      data.longitude = centLng;
      data.metadata = { geoType: geoMode, geometry: geoShape };
    }

    if (selectedGeoEntity) {
      data.metadata = { ...data.metadata, geoEntityId: selectedGeoEntity.id };
    }

    try {
      if (isEdit && item) {
        await updateMutation.mutateAsync({ id: item.id, body: data });
      } else {
        await createMutation.mutateAsync(data);
      }
      onBack();
    } catch {
      // mutation error handled by react-query
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
            <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {isEdit ? 'Edit Infrastructure' : 'Register New Infrastructure'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isEdit ? `Editing ${item?.name?.en ?? item?.code}` : 'Fill in the details below to register a new infrastructure'}
            </p>
          </div>
        </div>
        <button onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to list
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ═══ SECTION 1: Classification ═══ */}
        <SectionCard title="Classification" icon={<Building2 className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Category" required>
              <select value={category} onChange={(e) => handleCategoryChange(e.target.value)} className="form-select" required>
                <option value="">Select category...</option>
                {INFRASTRUCTURE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.en} / {c.fr}</option>)}
              </select>
            </FormField>
            <FormField label="Type" required>
              <select value={subType} onChange={(e) => setSubType(e.target.value)} className="form-select" required disabled={!category}>
                <option value="">Select type...</option>
                {availableSubTypes.map((s) => <option key={s.value} value={s.value}>{s.en} / {s.fr}</option>)}
              </select>
            </FormField>
            <FormField label="Code" required>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className="form-input" placeholder="e.g. LAB-KE-001" required maxLength={50} />
            </FormField>
            <FormField label="Name (EN)" required>
              <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="form-input" placeholder="Name in English" required />
            </FormField>
            <FormField label="Name (FR)">
              <input type="text" value={nameFr} onChange={(e) => setNameFr(e.target.value)} className="form-input" placeholder="Nom en français" />
            </FormField>
            <FormField label="Abbreviation">
              <input type="text" value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} className="form-input" placeholder="e.g. CVL" maxLength={50} />
            </FormField>
          </div>
        </SectionCard>

        {/* ═══ SECTION 2: Location & Admin Division ═══ */}
        <SectionCard title="Location & Administrative Division" icon={<MapPin className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Country" required>
              {countryLocked && scopedCountries.length === 1 ? (
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                  <span>{scopedCountries[0].flag}</span> <span>{scopedCountries[0].name}</span>
                </div>
              ) : (
                <select value={countryCode} onChange={(e) => handleCountryChange(e.target.value)} className="form-select" required>
                  <option value="">Select country...</option>
                  {scopedCountries.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
                </select>
              )}
            </FormField>
            <FormField label="Location Name">
              <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)} className="form-input" placeholder="e.g. Nairobi Industrial Area" />
            </FormField>
            <FormField label="Address">
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="form-input" placeholder="Full postal address" />
            </FormField>
          </div>

          {/* Cascading admin divisions — all on one row */}
          {countryCode && (
            <div className="mt-4 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 p-4 overflow-visible">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Administrative Division (optional)</p>
              <GeoLocationPicker
                countryCode={countryCode}
                countryId={countryGeoEntity?.id ?? countryCode}
                onChange={handleGeoPickerChange}
                layout="horizontal"
              />
            </div>
          )}
        </SectionCard>

        {/* ═══ SECTION 3: GPS Coordinates & Map ═══ */}
        <FullscreenMapSection
          geoMode={geoMode}
          setGeoMode={setGeoMode}
          geoPoint={geoPoint}
          setGeoPoint={setGeoPoint}
          geoShape={geoShape}
          setGeoShape={setGeoShape}
          mapCenter={mapCenter}
        />

        {/* ═══ SECTION 4: Details ═══ */}
        <SectionCard title="Details" icon={<Hash className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Year (reference)">
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="form-input" placeholder="2025" min={1900} max={2100} />
            </FormField>
            <FormField label="Year Established">
              <input type="number" value={yearEstablished} onChange={(e) => setYearEstablished(e.target.value)} className="form-input" placeholder="1995" min={1800} max={2100} />
            </FormField>
            <FormField label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-select">
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.en} / {s.fr}</option>)}
              </select>
            </FormField>
            <FormField label="Quantity">
              <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="form-input" placeholder="1" min={0} />
            </FormField>
            <FormField label="Capacity">
              <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="form-input" placeholder="e.g. 500" min={0} />
            </FormField>
            <FormField label="Comment">
              <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} className="form-input" placeholder="Optional note" />
            </FormField>
          </div>
        </SectionCard>

        {/* ═══ SECTION 5: Contact ═══ */}
        <SectionCard title="Contact Information" icon={<Phone className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Contact Person">
              <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="form-input" placeholder="Full name" />
            </FormField>
            <FormField label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" placeholder="contact@example.org" />
            </FormField>
            <FormField label="Telephone">
              <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="form-input" placeholder="+254 700 000 000" />
            </FormField>
          </div>
        </SectionCard>

        {/* ═══ SUBMIT ═══ */}
        <div className="flex items-center justify-end gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
          <button type="button" onClick={onBack}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={isSaving || !code || !nameEn || !category || !subType || !countryCode}
            className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50 transition-colors">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Register Infrastructure'}
          </button>
        </div>
      </form>

      {/* Shared form styles */}
      <style jsx>{`
        .form-input {
          width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;
          padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #111827; background: white; outline: none;
        }
        .form-input:focus { border-color: #006B3F; box-shadow: 0 0 0 2px rgba(0, 107, 63, 0.15); }
        .form-select {
          width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;
          padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #111827; background: white; appearance: none; outline: none;
        }
        .form-select:focus { border-color: #006B3F; box-shadow: 0 0 0 2px rgba(0, 107, 63, 0.15); }
        .form-select:disabled { opacity: 0.5; cursor: not-allowed; }
        @media (prefers-color-scheme: dark) {
          .form-input, .form-select { background: #1f2937; border-color: #374151; color: #f3f4f6; }
          .form-input:focus, .form-select:focus { border-color: #10b981; }
        }
      `}</style>
    </div>
  );
}

// ── Shared components ────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-5 py-3">
        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FullscreenMapSection({
  geoMode, setGeoMode, geoPoint, setGeoPoint, geoShape, setGeoShape, mapCenter,
}: {
  geoMode: 'point' | 'line' | 'polygon';
  setGeoMode: (m: 'point' | 'line' | 'polygon') => void;
  geoPoint: { lat: number; lng: number } | null;
  setGeoPoint: (v: { lat: number; lng: number } | null) => void;
  geoShape: Array<[number, number]> | null;
  setGeoShape: (v: Array<[number, number]> | null) => void;
  mapCenter: { lat: number; lng: number };
}) {
  const [fullscreen, setFullscreen] = useState(false);

  const modeTabs = [
    { key: 'point' as const, label: 'Point' },
    { key: 'line' as const, label: 'Line / Trace' },
    { key: 'polygon' as const, label: 'Polygon / Area' },
  ];

  // Close fullscreen on Escape
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [fullscreen]);

  // Lock body scroll when fullscreen
  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [fullscreen]);

  const renderMap = (heightClass: string, showManual: boolean, wrapperClass?: string) => (
    <>
      {geoMode === 'point' && (
        <GeoPointMap
          key={`point-${fullscreen}-${mapCenter.lat}-${mapCenter.lng}`}
          value={geoPoint}
          onChange={setGeoPoint}
          showManualEntry={showManual}
          autoDetect
          mapClassName={heightClass}
          className={wrapperClass}
        />
      )}
      {geoMode === 'line' && (
        <GeoPolygonMap
          key={`line-${fullscreen}-${mapCenter.lat}-${mapCenter.lng}`}
          value={geoShape}
          onChange={setGeoShape}
          mode="line"
          mapClassName={heightClass}
          className={wrapperClass}
        />
      )}
      {geoMode === 'polygon' && (
        <GeoPolygonMap
          key={`poly-${fullscreen}-${mapCenter.lat}-${mapCenter.lng}`}
          value={geoShape}
          onChange={setGeoShape}
          mode="polygon"
          mapClassName={heightClass}
          className={wrapperClass}
        />
      )}
    </>
  );

  // ── Fullscreen overlay ──
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-gray-900">
        {/* Fullscreen toolbar */}
        <div className="shrink-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Navigation className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">GPS Coordinates</span>
            <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5 ml-4">
              {modeTabs.map((tab) => (
                <button key={tab.key} type="button" onClick={() => setGeoMode(tab.key)}
                  className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    geoMode === tab.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300')}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => setFullscreen(false)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Minimize2 className="h-4 w-4" /> Exit fullscreen
          </button>
        </div>
        {/* Map fills remaining space */}
        <div className="flex-1 min-h-0 p-2 flex flex-col">
          {renderMap('h-full', false, 'h-full')}
        </div>
      </div>
    );
  }

  // ── Normal inline view ──
  return (
    <SectionCard title="GPS Coordinates" icon={<Navigation className="h-4 w-4" />}>
      {/* Mode tabs + fullscreen button */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
          {modeTabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setGeoMode(tab.key)}
              className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                geoMode === tab.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300')}>
              {tab.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setFullscreen(true)}
          title="Fullscreen map"
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
        </button>
      </div>

      {/* Map — normal height */}
      {renderMap('h-64', true)}
    </SectionCard>
  );
}

function FilterSelect({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 pr-8 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-aris-primary-500">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
