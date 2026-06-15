'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRIES } from '@/data/countries-config';
import { RECS } from '@/data/recs-config';
import { ADMIN_DIVISIONS } from '@/data/admin-divisions';
import { useGeoEntities, useGeoChildren } from '@/lib/api/geo-hooks';
import { useAdminLevels, type AdminLevel } from '@/lib/api/settings-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useAuthStore } from '@/lib/stores/auth-store';
// Note: removed unused 'Locale' import

interface AdminLocationFieldProps {
  levels: number[];
  requiredLevels?: number[];
  value: Record<string, string> | null;
  onChange: (value: Record<string, string> | null) => void;
  /** Campaign target countries (ISO codes) — restricts country dropdown */
  campaignTargetCountries?: string[];
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

/**
 * Get the label for an admin level, using country-specific config when available.
 * Priority: API admin levels > GADM levelTypes > generic fallback
 */
function getLevelLabel(
  level: number,
  locale: string,
  countryCode: string | undefined,
  apiAdminLevels: AdminLevel[] | undefined,
): string {
  if (level === 0) {
    return GENERIC_LEVEL_LABELS[0][locale] || 'Country';
  }

  // 1. Try API admin levels (from Settings > Countries > Admin Levels)
  if (apiAdminLevels && apiAdminLevels.length > 0) {
    const al = apiAdminLevels.find((a) => a.level === level);
    if (al?.name) {
      return al.name[locale] || al.name.en || al.name.fr || `Level ${level}`;
    }
  }

  // 2. Try GADM levelTypes for the country
  if (countryCode) {
    const gadm = ADMIN_DIVISIONS[countryCode];
    if (gadm?.levelTypes?.[String(level)]) {
      const lt = gadm.levelTypes[String(level)];
      if (locale === 'fr') return lt.fr || lt.en;
      if (locale === 'pt') return lt.pt || lt.en;
      return lt.en;
    }
  }

  // 3. Generic fallback
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

export function AdminLocationField({
  levels,
  requiredLevels = [],
  value,
  onChange,
  campaignTargetCountries,
}: AdminLocationFieldProps) {
  const locale = useLocaleStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const [selections, setSelections] = useState<Record<string, string>>(value || {});

  // Determine allowed country codes based on user scope + campaign targets
  const { allowedCodes, isCountryLocked } = useMemo(() => {
    // Campaign target countries take priority — restrict to those
    if (campaignTargetCountries && campaignTargetCountries.length > 0) {
      if (campaignTargetCountries.length === 1) {
        return { allowedCodes: campaignTargetCountries, isCountryLocked: true };
      }
      return { allowedCodes: campaignTargetCountries, isCountryLocked: false };
    }

    if (!user) return { allowedCodes: null, isCountryLocked: false };

    // Infer effective level from tenantLevel or fall back to role-based inference
    const effectiveLevel = user.tenantLevel
      || (['SUPER_ADMIN', 'CONTINENTAL_ADMIN'].includes(user.role) ? 'CONTINENTAL' : undefined)
      || (['REC_ADMIN'].includes(user.role) ? 'REC' : undefined)
      || 'MEMBER_STATE';

    if (effectiveLevel === 'MEMBER_STATE') {
      // Match tenantId in COUNTRIES config (all 55 countries have tenantId)
      const byTenant = Object.values(COUNTRIES).find((c) => c.tenantId === user.tenantId);
      if (byTenant) return { allowedCodes: [byTenant.code], isCountryLocked: true };
      // Fallback: extract country code from email domain (admin@cm.au-aris.org → CM)
      const emailDomain = user.email.split('@')[1] ?? '';
      const prefix = emailDomain.split('.')[0]?.toUpperCase();
      if (prefix && COUNTRIES[prefix]) {
        return { allowedCodes: [prefix], isCountryLocked: true };
      }
    }

    if (effectiveLevel === 'REC') {
      // Find this REC's member countries
      const rec = Object.values(RECS).find((r) => r.tenantId === user.tenantId);
      if (rec) return { allowedCodes: rec.countryCodes, isCountryLocked: false };
    }

    // CONTINENTAL or unknown → all countries
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
  const selectedAdmin1 = selections['level_1'] || '';
  const selectedAdmin2 = selections['level_2'] || '';
  const selectedAdmin3 = selections['level_3'] || '';
  const selectedAdmin4 = selections['level_4'] || '';

  const maxLevel = Math.max(...levels);

  // Fetch country-specific admin level labels (from Settings or GADM fallback)
  const countryConfig = selectedCountry ? COUNTRIES[selectedCountry] : undefined;
  const { data: adminLevelsData } = useAdminLevels(
    countryConfig?.tenantId ?? selectedCountry,
    selectedCountry || undefined,
    { enabled: !!selectedCountry },
  );
  const adminLevels: AdminLevel[] = adminLevelsData?.data ?? [];

  // Sorted country list — filtered by user scope
  const countryOptions = useMemo(
    () =>
      Object.values(COUNTRIES)
        .filter((c) => !allowedCodes || allowedCodes.includes(c.code))
        .map((c) => ({ value: c.code, label: `${c.flag} ${getCountryName(c, locale)}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [locale, allowedCodes],
  );

  // Fetch ADMIN1 divisions for the selected country
  const { data: admin1Data } = useGeoEntities(
    selectedCountry
      ? { level: 'ADMIN1', countryCode: selectedCountry, limit: 200 }
      : undefined,
  );

  // Fetch ADMIN2 divisions for the selected ADMIN1 (primary: children of admin1)
  const { data: admin2ChildData } = useGeoChildren(
    selectedAdmin1 || undefined,
    { limit: 200 },
  );

  // Fallback: fetch all ADMIN2 by country when children query returns empty
  // (handles countries like Kenya where admin2 parentCode points to country, not admin1)
  const admin2ChildEmpty = selectedAdmin1 && (!admin2ChildData?.data || admin2ChildData.data.length === 0);
  const { data: admin2ByCountryData } = useGeoEntities(
    admin2ChildEmpty && selectedCountry
      ? { level: 'ADMIN2', countryCode: selectedCountry, limit: 500 }
      : undefined,
  );

  // Resolve the selected Admin1's name/code to filter GADM fallback
  const selectedAdmin1Name = useMemo(() => {
    if (!selectedAdmin1 || !admin1Data?.data) return undefined;
    const a1 = admin1Data.data.find((e) => e.id === selectedAdmin1);
    if (!a1) return undefined;
    const n = a1.name;
    return {
      name: typeof n === 'string' ? n : (n?.en || n?.fr || ''),
      code: a1.code,
    };
  }, [selectedAdmin1, admin1Data]);

  const admin1Options = useMemo(() => {
    if (!admin1Data?.data) return [];
    return admin1Data.data
      .map((e) => {
        const n = e.name;
        const label = typeof n === 'string' ? n : (n?.[locale] || n?.en || n?.fr || e.code);
        return { value: e.id, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [admin1Data, locale]);

  const admin2Options = useMemo(() => {
    // 1. If API children query returned data, use it directly
    if (admin2ChildData?.data && admin2ChildData.data.length > 0) {
      return admin2ChildData.data
        .map((e) => {
          const n = e.name;
          const label = typeof n === 'string' ? n : (n?.[locale] || n?.en || n?.fr || e.code);
          return { value: e.id, label };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    // 2. Fallback: try GADM local data filtered by Admin1
    if (selectedCountry && selectedAdmin1Name) {
      const gadm = ADMIN_DIVISIONS[selectedCountry];
      if (gadm?.admin2) {
        // Find the GADM admin1 matching the selected one (by name or code)
        const gadmParent = gadm.admin1.find(
          (a1) => a1.name === selectedAdmin1Name.name
            || a1.code === selectedAdmin1Name.code
            || a1.name.toLowerCase() === selectedAdmin1Name.name.toLowerCase(),
        );
        if (gadmParent) {
          const filtered = gadm.admin2.filter((a2) => a2.parentGid === gadmParent.gid);
          if (filtered.length > 0) {
            return filtered
              .map((a2) => ({ value: a2.gid, label: a2.name }))
              .sort((a, b) => a.label.localeCompare(b.label));
          }
        }
      }
    }

    // 3. Last resort: all ADMIN2 from API (unfiltered — better than nothing)
    const fallbackItems = admin2ByCountryData?.data ?? [];
    if (fallbackItems.length === 0) return [];
    return fallbackItems
      .map((e) => {
        const n = e.name;
        const label = typeof n === 'string' ? n : (n?.[locale] || n?.en || n?.fr || e.code);
        return { value: e.id, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [admin2ChildData, admin2ByCountryData, selectedCountry, selectedAdmin1Name, locale]);

  // Fetch ADMIN3 divisions for the selected ADMIN2
  const { data: admin3ChildData } = useGeoChildren(
    selectedAdmin2 || undefined,
    { limit: 500 },
  );

  // Fallback: fetch all ADMIN3 by country when children query returns empty
  const admin3ChildEmpty = selectedAdmin2 && (!admin3ChildData?.data || admin3ChildData.data.length === 0);
  const { data: admin3ByCountryData } = useGeoEntities(
    admin3ChildEmpty && selectedCountry
      ? { level: 'ADMIN3', countryCode: selectedCountry, limit: 500 }
      : undefined,
  );

  const admin3Options = useMemo(() => {
    const items = (admin3ChildData?.data && admin3ChildData.data.length > 0)
      ? admin3ChildData.data
      : (admin3ByCountryData?.data ?? []);

    if (items.length === 0) return [];
    return items
      .map((e) => {
        const n = e.name;
        const label = typeof n === 'string' ? n : (n?.[locale] || n?.en || n?.fr || e.code);
        return { value: e.id, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [admin3ChildData, admin3ByCountryData, locale]);

  // Fetch ADMIN4 divisions for the selected ADMIN3
  const { data: admin4ChildData } = useGeoChildren(
    maxLevel >= 4 ? (selectedAdmin3 || undefined) : undefined,
    { limit: 500 },
  );
  const admin4ChildEmpty = selectedAdmin3 && (!admin4ChildData?.data || admin4ChildData.data.length === 0);
  const { data: admin4ByCountryData } = useGeoEntities(
    admin4ChildEmpty && selectedCountry && maxLevel >= 4
      ? { level: 'ADMIN4', countryCode: selectedCountry, limit: 500 }
      : undefined,
  );
  const admin4Options = useMemo(() => {
    const items = (admin4ChildData?.data && admin4ChildData.data.length > 0)
      ? admin4ChildData.data
      : (admin4ByCountryData?.data ?? []);
    if (items.length === 0) return [];
    return items
      .map((e) => {
        const n = e.name;
        const label = typeof n === 'string' ? n : (n?.[locale] || n?.en || n?.fr || e.code);
        return { value: e.id, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [admin4ChildData, admin4ByCountryData, locale]);

  // Fetch ADMIN5 divisions for the selected ADMIN4
  const { data: admin5ChildData } = useGeoChildren(
    maxLevel >= 5 ? (selectedAdmin4 || undefined) : undefined,
    { limit: 500 },
  );
  const admin5ChildEmpty = selectedAdmin4 && (!admin5ChildData?.data || admin5ChildData.data.length === 0);
  const { data: admin5ByCountryData } = useGeoEntities(
    admin5ChildEmpty && selectedCountry && maxLevel >= 5
      ? { level: 'ADMIN5', countryCode: selectedCountry, limit: 500 }
      : undefined,
  );
  const admin5Options = useMemo(() => {
    const items = (admin5ChildData?.data && admin5ChildData.data.length > 0)
      ? admin5ChildData.data
      : (admin5ByCountryData?.data ?? []);
    if (items.length === 0) return [];
    return items
      .map((e) => {
        const n = e.name;
        const label = typeof n === 'string' ? n : (n?.[locale] || n?.en || n?.fr || e.code);
        return { value: e.id, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [admin5ChildData, admin5ByCountryData, locale]);

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
    setSelections(updated);
    onChange(Object.keys(updated).length > 0 ? updated : null);
  };

  const getOptionsForLevel = (level: number): Array<{ value: string; label: string }> => {
    switch (level) {
      case 0:
        return countryOptions;
      case 1:
        return admin1Options;
      case 2:
        return admin2Options;
      case 3:
        return admin3Options;
      case 4:
        return admin4Options;
      case 5:
        return admin5Options;
      default:
        return [];
    }
  };

  const isLevelDisabled = (level: number): boolean => {
    // Country level is locked for MEMBER_STATE users
    if (level === 0 && isCountryLocked) return true;
    if (level === Math.min(...levels)) return false;
    return !selections[`level_${level - 1}`];
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <MapPin className="h-4 w-4" />
        <span>{locale === 'fr' ? 'Localisation Administrative' : 'Administrative Location'}</span>
      </div>
      <div className={cn('grid grid-cols-1 gap-3', levels.length <= 3 ? 'md:grid-cols-3' : levels.length <= 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3')}>
        {levels.map((level) => {
          const isRequired = requiredLevels.includes(level);
          const disabled = isLevelDisabled(level);
          const options = getOptionsForLevel(level);
          const levelLabel = getLevelLabel(level, locale, selectedCountry || undefined, adminLevels);
          return (
            <div key={level}>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {levelLabel}
                {isRequired && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <select
                value={selections[`level_${level}`] || ''}
                onChange={(e) => handleChange(level, e.target.value)}
                disabled={disabled}
                className={cn(inputClass, disabled && 'opacity-50 cursor-not-allowed')}
              >
                <option value="">
                  {disabled
                    ? (locale === 'fr' ? 'Sélectionnez le parent...' : 'Select parent first...')
                    : (locale === 'fr' ? `Sélectionner ${levelLabel}...` : `Select ${levelLabel}...`)
                  }
                </option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
