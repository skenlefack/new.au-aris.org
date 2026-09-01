'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapPin, Pencil, List, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRIES } from '@/data/countries-config';
import { RECS } from '@/data/recs-config';
import { ADMIN_DIVISIONS } from '@/data/admin-divisions';
import { useGeoEntities, useGeoChildren, useGeoZones } from '@/lib/api/geo-hooks';
import { useAdminLevels, type AdminLevel } from '@/lib/api/settings-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useAuthStore } from '@/lib/stores/auth-store';

/** Prefix for text values that need to be created as geo entities on save */
export const NEW_GEO_PREFIX = '__new:';

interface AdminLocationFieldProps {
  levels: number[];
  requiredLevels?: number[];
  value: Record<string, string> | null;
  onChange: (value: Record<string, string> | null) => void;
  /** Campaign target countries (ISO codes) — restricts country dropdown */
  campaignTargetCountries?: string[];
  /** Whether to show a domain zone selector (filters Admin1 options) */
  showZones?: boolean;
  /** Domain code to scope zone options */
  domainCode?: string;
}

/** Generic fallback labels when no country-specific config exists */
const GENERIC_LEVEL_LABELS: Record<number, Record<string, string>> = {
  0: { en: 'Country', fr: 'Pays', pt: 'País', ar: 'البلد', es: 'País' },
  1: { en: 'Region / Province', fr: 'Région / Province', pt: 'Região / Província', ar: 'المنطقة / المحافظة', es: 'Región / Provincia' },
  2: { en: 'District / Department', fr: 'District / Département', pt: 'Distrito / Departamento', ar: 'المقاطعة / الإدارة', es: 'Distrito / Departamento' },
  3: { en: 'Sub-district / Commune', fr: 'Sous-district / Commune', pt: 'Sub-distrito / Comuna', ar: 'البلدية / الناحية', es: 'Subdistrito / Comuna' },
  4: { en: 'Ward / Village', fr: 'Quartier / Village', pt: 'Bairro / Aldeia', ar: 'الحي / القرية', es: 'Barrio / Aldea' },
  5: { en: 'Locality / Hamlet', fr: 'Localité / Hameau', pt: 'Localidade', ar: 'المحلة', es: 'Localidad' },
};

function getLevelLabel(
  level: number,
  locale: string,
  countryCode: string | undefined,
  apiAdminLevels: AdminLevel[] | undefined,
): string {
  if (level === 0) {
    return GENERIC_LEVEL_LABELS[0][locale] || 'Country';
  }

  if (apiAdminLevels && apiAdminLevels.length > 0) {
    const al = apiAdminLevels.find((a) => a.level === level);
    if (al?.name) {
      return al.name[locale] || al.name.en || al.name.fr || `Level ${level}`;
    }
  }

  if (countryCode) {
    const gadm = ADMIN_DIVISIONS[countryCode];
    if (gadm?.levelTypes?.[String(level)]) {
      const lt = gadm.levelTypes[String(level)];
      if (locale === 'fr') return lt.fr || lt.en;
      if (locale === 'pt') return lt.pt || lt.en;
      return lt.en;
    }
  }

  const labels = GENERIC_LEVEL_LABELS[level];
  if (!labels) return `Level ${level}`;
  return labels[locale] || labels.en || `Level ${level}`;
}

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500';

function getCountryName(c: (typeof COUNTRIES)[string], locale: string): string {
  if (locale === 'fr') return c.nameFr || c.name;
  return c.name;
}

/** GeoLevel string for a given numeric level */
function geoLevelForIndex(level: number): string {
  if (level === 0) return 'COUNTRY';
  return `ADMIN${level}`;
}

export function AdminLocationField({
  levels,
  requiredLevels = [],
  value,
  onChange,
  campaignTargetCountries,
  showZones = false,
  domainCode,
}: AdminLocationFieldProps) {
  const locale = useLocaleStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const [selections, setSelections] = useState<Record<string, string>>(value || {});
  // Levels manually toggled to text-input mode by the user (even when options exist)
  const [manualModeLevels, setManualModeLevels] = useState<Set<number>>(new Set());

  // Determine allowed country codes based on user scope + campaign targets
  const { allowedCodes, isCountryLocked } = useMemo(() => {
    if (campaignTargetCountries && campaignTargetCountries.length > 0) {
      if (campaignTargetCountries.length === 1) {
        return { allowedCodes: campaignTargetCountries, isCountryLocked: true };
      }
      return { allowedCodes: campaignTargetCountries, isCountryLocked: false };
    }

    if (!user) return { allowedCodes: null, isCountryLocked: false };

    const effectiveLevel = user.tenantLevel
      || (['SUPER_ADMIN', 'CONTINENTAL_ADMIN'].includes(user.role) ? 'CONTINENTAL' : undefined)
      || (['REC_ADMIN'].includes(user.role) ? 'REC' : undefined)
      || 'MEMBER_STATE';

    if (effectiveLevel === 'MEMBER_STATE') {
      const byTenant = Object.values(COUNTRIES).find((c) => c.tenantId === user.tenantId);
      if (byTenant) return { allowedCodes: [byTenant.code], isCountryLocked: true };
      const emailDomain = user.email.split('@')[1] ?? '';
      const prefix = emailDomain.split('.')[0]?.toUpperCase();
      if (prefix && COUNTRIES[prefix]) {
        return { allowedCodes: [prefix], isCountryLocked: true };
      }
    }

    if (effectiveLevel === 'REC') {
      const rec = Object.values(RECS).find((r) => r.tenantId === user.tenantId);
      if (rec) return { allowedCodes: rec.countryCodes, isCountryLocked: false };
    }

    return { allowedCodes: null, isCountryLocked: false };
  }, [user, campaignTargetCountries]);

  // Auto-select country for MEMBER_STATE users
  const autoSelectedRef = React.useRef(false);
  useEffect(() => {
    if (isCountryLocked && allowedCodes?.length === 1 && !autoSelectedRef.current) {
      autoSelectedRef.current = true;
      const code = allowedCodes[0];
      if (!selections['level_0'] || selections['level_0'] !== code) {
        const updated = { ...selections, level_0: code };
        setSelections(updated);
        onChange(updated);
      }
    }
  }, [isCountryLocked, allowedCodes, selections, onChange]);

  useEffect(() => {
    if (value) setSelections(value);
  }, [value]);

  const selectedCountry = selections['level_0'] || '';

  // ── Zone selector (domain-specific geographic zones) ──────────────
  const { data: zonesData } = useGeoZones(
    showZones && selectedCountry ? selectedCountry : undefined,
    showZones && domainCode ? domainCode : undefined,
  );
  const zones = zonesData?.data ?? [];
  const selectedZoneId = selections['zone_id'] || '';
  const selectedZone = zones.find((z: any) => z.id === selectedZoneId);

  const selectedAdmin1 = selections['level_1'] || '';
  const selectedAdmin2 = selections['level_2'] || '';
  const selectedAdmin3 = selections['level_3'] || '';
  const selectedAdmin4 = selections['level_4'] || '';

  const maxLevel = Math.max(...levels);

  // Fetch country-specific admin level labels
  const countryConfig = selectedCountry ? COUNTRIES[selectedCountry] : undefined;
  const { data: adminLevelsData } = useAdminLevels(
    countryConfig?.tenantId ?? selectedCountry,
    selectedCountry || undefined,
    { enabled: !!selectedCountry },
  );
  const adminLevels: AdminLevel[] = adminLevelsData?.data ?? [];

  // Sorted country list
  const countryOptions = useMemo(
    () =>
      Object.values(COUNTRIES)
        .filter((c) => !allowedCodes || allowedCodes.includes(c.code))
        .map((c) => ({ value: c.code, label: `${c.flag} ${getCountryName(c, locale)}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [locale, allowedCodes],
  );

  // ═══════════════════════════════════════════════════════════════════
  // Fetch divisions for each level
  // ═══════════════════════════════════════════════════════════════════

  // ADMIN1
  const { data: admin1Data, isLoading: admin1Loading } = useGeoEntities(
    selectedCountry ? { level: 'ADMIN1', countryCode: selectedCountry, limit: 200 } : undefined,
  );

  // ADMIN2 — children of selected admin1
  const { data: admin2ChildData, isLoading: admin2ChildLoading } = useGeoChildren(
    selectedAdmin1 && !selectedAdmin1.startsWith(NEW_GEO_PREFIX) ? selectedAdmin1 : undefined,
    { limit: 200 },
  );
  const admin2ChildEmpty = selectedAdmin1 && !selectedAdmin1.startsWith(NEW_GEO_PREFIX) && (!admin2ChildData?.data || admin2ChildData.data.length === 0);
  const { data: admin2ByCountryData, isLoading: admin2CountryLoading } = useGeoEntities(
    admin2ChildEmpty && selectedCountry ? { level: 'ADMIN2', countryCode: selectedCountry, limit: 500 } : undefined,
  );

  // ADMIN3 — children of selected admin2
  const { data: admin3ChildData, isLoading: admin3ChildLoading } = useGeoChildren(
    selectedAdmin2 && !selectedAdmin2.startsWith(NEW_GEO_PREFIX) ? selectedAdmin2 : undefined,
    { limit: 500 },
  );
  const admin3ChildEmpty = selectedAdmin2 && !selectedAdmin2.startsWith(NEW_GEO_PREFIX) && (!admin3ChildData?.data || admin3ChildData.data.length === 0);
  const { data: admin3ByCountryData, isLoading: admin3CountryLoading } = useGeoEntities(
    admin3ChildEmpty && selectedCountry ? { level: 'ADMIN3', countryCode: selectedCountry, limit: 500 } : undefined,
  );

  // ADMIN4 — children of selected admin3
  const { data: admin4ChildData, isLoading: admin4ChildLoading } = useGeoChildren(
    maxLevel >= 4 && selectedAdmin3 && !selectedAdmin3.startsWith(NEW_GEO_PREFIX) ? selectedAdmin3 : undefined,
    { limit: 500 },
  );
  const admin4ChildEmpty = selectedAdmin3 && !selectedAdmin3.startsWith(NEW_GEO_PREFIX) && (!admin4ChildData?.data || admin4ChildData.data.length === 0);
  const { data: admin4ByCountryData, isLoading: admin4CountryLoading } = useGeoEntities(
    admin4ChildEmpty && selectedCountry && maxLevel >= 4 ? { level: 'ADMIN4', countryCode: selectedCountry, limit: 500 } : undefined,
  );

  // ADMIN5 — children of selected admin4
  const { data: admin5ChildData, isLoading: admin5ChildLoading } = useGeoChildren(
    maxLevel >= 5 && selectedAdmin4 && !selectedAdmin4.startsWith(NEW_GEO_PREFIX) ? selectedAdmin4 : undefined,
    { limit: 500 },
  );
  const admin5ChildEmpty = selectedAdmin4 && !selectedAdmin4.startsWith(NEW_GEO_PREFIX) && (!admin5ChildData?.data || admin5ChildData.data.length === 0);
  const { data: admin5ByCountryData, isLoading: admin5CountryLoading } = useGeoEntities(
    admin5ChildEmpty && selectedCountry && maxLevel >= 5 ? { level: 'ADMIN5', countryCode: selectedCountry, limit: 500 } : undefined,
  );

  // Resolve selected Admin1 name for GADM fallback filtering
  const selectedAdmin1Name = useMemo(() => {
    if (!selectedAdmin1 || selectedAdmin1.startsWith(NEW_GEO_PREFIX) || !admin1Data?.data) return undefined;
    const a1 = admin1Data.data.find((e) => e.id === selectedAdmin1);
    if (!a1) return undefined;
    const n = a1.name;
    return {
      name: typeof n === 'string' ? n : (n?.en || n?.fr || ''),
      code: a1.code,
    };
  }, [selectedAdmin1, admin1Data]);

  // ═══════════════════════════════════════════════════════════════════
  // Build options arrays for each level
  // ═══════════════════════════════════════════════════════════════════

  const buildOptions = useCallback((items: Array<{ id: string; name: string | Record<string, string>; code: string }>) => {
    return items
      .map((e) => {
        const n = e.name;
        const label = typeof n === 'string' ? n : (n?.[locale] || n?.en || n?.fr || e.code);
        return { value: e.id, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [locale]);

  const admin1Options = useMemo(() => {
    if (!admin1Data?.data) return [];
    const list = admin1Data.data as any[];
    const filtered = selectedZone
      ? list.filter((e: any) => selectedZone.memberIds.includes(e.id))
      : list;
    return buildOptions(filtered);
  }, [admin1Data, buildOptions, selectedZone]);

  const admin2Options = useMemo(() => {
    if (admin2ChildData?.data && admin2ChildData.data.length > 0) {
      return buildOptions(admin2ChildData.data as any);
    }
    // GADM fallback
    if (selectedCountry && selectedAdmin1Name) {
      const gadm = ADMIN_DIVISIONS[selectedCountry];
      if (gadm?.admin2) {
        const gadmParent = gadm.admin1.find(
          (a1) => a1.name === selectedAdmin1Name.name
            || a1.code === selectedAdmin1Name.code
            || a1.name.toLowerCase() === selectedAdmin1Name.name.toLowerCase(),
        );
        if (gadmParent) {
          const filtered = gadm.admin2.filter((a2) => a2.parentGid === gadmParent.gid);
          if (filtered.length > 0) {
            return filtered.map((a2) => ({ value: a2.gid, label: a2.name })).sort((a, b) => a.label.localeCompare(b.label));
          }
        }
      }
    }
    const fallbackItems = admin2ByCountryData?.data ?? [];
    if (fallbackItems.length === 0) return [];
    return buildOptions(fallbackItems as any);
  }, [admin2ChildData, admin2ByCountryData, selectedCountry, selectedAdmin1Name, buildOptions]);

  const admin3Options = useMemo(() => {
    const items = (admin3ChildData?.data && admin3ChildData.data.length > 0)
      ? admin3ChildData.data : (admin3ByCountryData?.data ?? []);
    if (items.length === 0) return [];
    return buildOptions(items as any);
  }, [admin3ChildData, admin3ByCountryData, buildOptions]);

  const admin4Options = useMemo(() => {
    const items = (admin4ChildData?.data && admin4ChildData.data.length > 0)
      ? admin4ChildData.data : (admin4ByCountryData?.data ?? []);
    if (items.length === 0) return [];
    return buildOptions(items as any);
  }, [admin4ChildData, admin4ByCountryData, buildOptions]);

  const admin5Options = useMemo(() => {
    const items = (admin5ChildData?.data && admin5ChildData.data.length > 0)
      ? admin5ChildData.data : (admin5ByCountryData?.data ?? []);
    if (items.length === 0) return [];
    return buildOptions(items as any);
  }, [admin5ChildData, admin5ByCountryData, buildOptions]);

  // ═══════════════════════════════════════════════════════════════════
  // Detect which levels should fall back to text input
  // A level is in "text mode" when:
  //   1. Its parent is selected (not empty)
  //   2. The parent is itself a text value (__new:) OR
  //   3. The options for this level are empty AND data is done loading
  // Once a level goes text, all subsequent levels are also text.
  // ═══════════════════════════════════════════════════════════════════

  const levelLoadingMap: Record<number, boolean> = {
    1: admin1Loading,
    2: admin2ChildLoading || (!!admin2ChildEmpty && admin2CountryLoading),
    3: admin3ChildLoading || (!!admin3ChildEmpty && admin3CountryLoading),
    4: admin4ChildLoading || (!!admin4ChildEmpty && admin4CountryLoading),
    5: admin5ChildLoading || (!!admin5ChildEmpty && admin5CountryLoading),
  };

  const optionsMap: Record<number, Array<{ value: string; label: string }>> = {
    0: countryOptions,
    1: admin1Options,
    2: admin2Options,
    3: admin3Options,
    4: admin4Options,
    5: admin5Options,
  };

  /** Determine which levels are in text-input (fallback) mode.
   *  A level is text mode when:
   *  - User manually toggled it (manualModeLevels), OR
   *  - Parent is a text value (__new:), OR
   *  - Options are empty after loading
   *  Once a level is text, all subsequent levels are also text.
   */
  const textModeLevels = useMemo(() => {
    const textLevels = new Set<number>();
    let forcedText = false;

    for (const level of [...levels].sort((a, b) => a - b)) {
      if (level === 0) continue; // Country is always a select

      if (forcedText) {
        textLevels.add(level);
        continue;
      }

      // User manually toggled this level to text mode
      if (manualModeLevels.has(level)) {
        textLevels.add(level);
        forcedText = true;
        continue;
      }

      const parentLevel = level - 1;
      const parentVal = selections[`level_${parentLevel}`];

      // If parent is a text value, this level must be text too
      if (parentVal && parentVal.startsWith(NEW_GEO_PREFIX)) {
        textLevels.add(level);
        forcedText = true;
        continue;
      }

      // If parent is selected and options are empty (and done loading), switch to text
      if (parentVal && !levelLoadingMap[level] && optionsMap[level].length === 0) {
        textLevels.add(level);
        forcedText = true;
        continue;
      }
    }
    return textLevels;
  }, [levels, selections, manualModeLevels, levelLoadingMap, optionsMap]);

  // ═══════════════════════════════════════════════════════════════════
  // Event handlers
  // ═══════════════════════════════════════════════════════════════════

  const handleChange = (level: number, val: string) => {
    const updated = { ...selections };
    if (val) {
      updated[`level_${level}`] = val;
    } else {
      delete updated[`level_${level}`];
    }
    // Clear deeper levels
    for (const l of levels) {
      if (l > level) {
        delete updated[`level_${l}`];
      }
    }
    // Clear zone and admin1+ when country changes
    if (level === 0) {
      delete updated['zone_id'];
    }
    setSelections(updated);
    onChange(Object.keys(updated).length > 0 ? updated : null);
  };

  const handleZoneChange = (zoneId: string) => {
    const updated = { ...selections };
    if (zoneId) {
      updated['zone_id'] = zoneId;
    } else {
      delete updated['zone_id'];
    }
    // Clear admin1 and deeper when zone changes
    for (const l of levels) {
      if (l >= 1) delete updated[`level_${l}`];
    }
    setSelections(updated);
    onChange(Object.keys(updated).length > 0 ? updated : null);
  };

  const handleTextChange = (level: number, text: string) => {
    const updated = { ...selections };
    if (text.trim()) {
      updated[`level_${level}`] = `${NEW_GEO_PREFIX}${text}`;
    } else {
      delete updated[`level_${level}`];
    }
    // Clear deeper levels
    for (const l of levels) {
      if (l > level) {
        delete updated[`level_${l}`];
      }
    }
    setSelections(updated);
    onChange(Object.keys(updated).length > 0 ? updated : null);
  };

  const isLevelDisabled = (level: number): boolean => {
    if (level === 0 && isCountryLocked) return true;
    if (level === Math.min(...levels)) return false;
    const parentVal = selections[`level_${level - 1}`];
    return !parentVal;
  };

  /** Toggle a level between select and manual text input */
  const toggleManualMode = (level: number) => {
    setManualModeLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
    // Clear this level and deeper levels when toggling
    const updated = { ...selections };
    for (const l of levels) {
      if (l >= level) delete updated[`level_${l}`];
    }
    setSelections(updated);
    onChange(Object.keys(updated).length > 0 ? updated : null);
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <MapPin className="h-4 w-4" />
        <span>{locale === 'fr' ? 'Localisation Administrative' : 'Administrative Location'}</span>
      </div>
      {/* Zone selector — shown when showZones is enabled and a country is selected */}
      {showZones && selectedCountry && zones.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            {locale === 'fr' ? 'Zone' : 'Zone'}
          </label>
          <select
            value={selectedZoneId}
            onChange={(e) => handleZoneChange(e.target.value)}
            className={inputClass}
          >
            <option value="">
              {locale === 'fr' ? 'Toutes les divisions' : 'All divisions'}
            </option>
            {zones.map((z: any) => {
              const zoneName = typeof z.name === 'string' ? z.name : (z.name?.[locale] || z.name?.en || z.code);
              return (
                <option key={z.id} value={z.id}>{zoneName}</option>
              );
            })}
          </select>
        </div>
      )}

      <div className={cn('grid grid-cols-1 gap-3', levels.length <= 3 ? 'md:grid-cols-3' : levels.length <= 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3')}>
        {levels.map((level) => {
          const isRequired = requiredLevels.includes(level);
          const disabled = isLevelDisabled(level);
          const levelLabel = getLevelLabel(level, locale, selectedCountry || undefined, adminLevels);
          const isTextMode = textModeLevels.has(level);
          const isLoading = !isTextMode && level > 0 && levelLoadingMap[level] && !!selections[`level_${level - 1}`];
          const currentVal = selections[`level_${level}`] || '';

          // Can toggle: level > 0, not disabled, not forced by parent being __new:
          const parentVal = level > 0 ? selections[`level_${level - 1}`] : undefined;
          const isForcedByParent = parentVal?.startsWith(NEW_GEO_PREFIX) ?? false;
          const canToggle = level > 0 && !disabled && !isForcedByParent;

          return (
            <div key={level}>
              <div className="flex items-center gap-1.5 mb-1">
                {/* Toggle button — switch between select and manual input */}
                {canToggle && (
                  <button
                    type="button"
                    onClick={() => toggleManualMode(level)}
                    title={isTextMode
                      ? (locale === 'fr' ? 'Basculer en liste' : 'Switch to list')
                      : (locale === 'fr' ? 'Basculer en saisie libre' : 'Switch to manual entry')
                    }
                    className={cn(
                      'flex-shrink-0 rounded p-0.5 transition-colors',
                      isTextMode
                        ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                        : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30',
                    )}
                  >
                    {isTextMode
                      ? <List className="h-3.5 w-3.5" />
                      : <Pencil className="h-3.5 w-3.5" />
                    }
                  </button>
                )}
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {levelLabel}
                  {isRequired && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {isTextMode && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    <Pencil className="h-2.5 w-2.5" />
                    {locale === 'fr' ? 'Nouveau' : 'New'}
                  </span>
                )}
              </div>

              {isTextMode ? (
                /* ── Text input fallback ── */
                <input
                  type="text"
                  value={currentVal.startsWith(NEW_GEO_PREFIX) ? currentVal.slice(NEW_GEO_PREFIX.length) : ''}
                  onChange={(e) => handleTextChange(level, e.target.value)}
                  disabled={disabled}
                  placeholder={locale === 'fr' ? `Saisir le nom...` : `Enter name...`}
                  className={cn(
                    inputClass,
                    'border-amber-300 focus:border-amber-400 focus:ring-amber-400 dark:border-amber-700',
                    disabled && 'opacity-50 cursor-not-allowed',
                  )}
                />
              ) : (
                /* ── Standard select ── */
                <select
                  value={currentVal}
                  onChange={(e) => handleChange(level, e.target.value)}
                  disabled={disabled || isLoading}
                  className={cn(inputClass, (disabled || isLoading) && 'opacity-50 cursor-not-allowed')}
                >
                  <option value="">
                    {isLoading
                      ? (locale === 'fr' ? 'Chargement...' : 'Loading...')
                      : disabled
                        ? (locale === 'fr' ? 'Sélectionnez le parent...' : 'Select parent first...')
                        : (locale === 'fr' ? `Sélectionner ${levelLabel}...` : `Select ${levelLabel}...`)
                    }
                  </option>
                  {optionsMap[level].map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      {/* Info banner when text mode is active */}
      {textModeLevels.size > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {locale === 'fr'
            ? 'Les divisions administratives manquantes seront créées automatiquement lors de l\'enregistrement.'
            : 'Missing administrative divisions will be created automatically when you save.'}
        </div>
      )}
    </div>
  );
}
