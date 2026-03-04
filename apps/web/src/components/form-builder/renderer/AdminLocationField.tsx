'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRIES } from '@/data/countries-config';
import { RECS } from '@/data/recs-config';
import { useGeoEntities, useGeoChildren } from '@/lib/api/geo-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { Locale } from '@/lib/i18n/config';

interface AdminLocationFieldProps {
  levels: number[];
  requiredLevels?: number[];
  value: Record<string, string> | null;
  onChange: (value: Record<string, string> | null) => void;
}

const LEVEL_LABELS: Record<number, Record<string, string>> = {
  0: { en: 'Country', fr: 'Pays', pt: 'País', ar: 'البلد', es: 'País' },
  1: { en: 'Region / Province', fr: 'Région / Province', pt: 'Região / Província', ar: 'المنطقة / المحافظة', es: 'Región / Provincia' },
  2: { en: 'District / Department', fr: 'District / Département', pt: 'Distrito / Departamento', ar: 'المقاطعة / الإدارة', es: 'Distrito / Departamento' },
  3: { en: 'Sub-district / Commune', fr: 'Sous-district / Commune', pt: 'Sub-distrito / Comuna', ar: 'البلدية / الناحية', es: 'Subdistrito / Comuna' },
  4: { en: 'Ward / Village', fr: 'Quartier / Village', pt: 'Bairro / Aldeia', ar: 'الحي / القرية', es: 'Barrio / Aldea' },
};

function getLevelLabel(level: number, locale: string): string {
  const labels = LEVEL_LABELS[level];
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
}: AdminLocationFieldProps) {
  const locale = useLocaleStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const [selections, setSelections] = useState<Record<string, string>>(value || {});

  // Determine allowed country codes based on user scope
  const { allowedCodes, isCountryLocked } = useMemo(() => {
    if (!user) return { allowedCodes: null, isCountryLocked: false };

    if (user.tenantLevel === 'MEMBER_STATE') {
      // 1. Try matching tenantId in COUNTRIES config (pilot countries)
      const byTenant = Object.values(COUNTRIES).find((c) => c.tenantId === user.tenantId);
      if (byTenant) return { allowedCodes: [byTenant.code], isCountryLocked: true };
      // 2. Fallback: extract country code from email domain (admin@cm.au-aris.org → CM)
      const emailDomain = user.email.split('@')[1] ?? '';
      const prefix = emailDomain.split('.')[0]?.toUpperCase();
      if (prefix && COUNTRIES[prefix]) {
        return { allowedCodes: [prefix], isCountryLocked: true };
      }
    }

    if (user.tenantLevel === 'REC') {
      // Find this REC's member countries
      const rec = Object.values(RECS).find((r) => r.tenantId === user.tenantId);
      if (rec) return { allowedCodes: rec.countryCodes, isCountryLocked: false };
    }

    // CONTINENTAL or unknown → all countries
    return { allowedCodes: null, isCountryLocked: false };
  }, [user]);

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

  // Fetch ADMIN2 divisions for the selected ADMIN1
  const { data: admin2Data } = useGeoChildren(
    selectedAdmin1 || undefined,
    { limit: 200 },
  );

  const admin1Options = useMemo(() => {
    if (!admin1Data?.data) return [];
    return admin1Data.data
      .map((e) => ({
        value: e.id,
        label: e.name[locale] || e.name.en || e.code,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [admin1Data, locale]);

  const admin2Options = useMemo(() => {
    if (!admin2Data?.data) return [];
    return admin2Data.data
      .map((e) => ({
        value: e.id,
        label: e.name[locale] || e.name.en || e.code,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [admin2Data, locale]);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {levels.map((level) => {
          const isRequired = requiredLevels.includes(level);
          const disabled = isLevelDisabled(level);
          const options = getOptionsForLevel(level);
          const levelLabel = getLevelLabel(level, locale);
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
