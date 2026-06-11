'use client';

import React, { useMemo, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { COUNTRIES, type CountryConfig } from '@/data/countries-config';
import { RECS, REC_ORDER, type RecConfig } from '@/data/recs-config';
import { X, ChevronDown } from 'lucide-react';

interface PaidRecsFieldProps {
  value: { countries: string[]; recs: string[] } | null;
  onChange: (value: { countries: string[]; recs: string[] }) => void;
  readOnly?: boolean;
}

const ALL_COUNTRIES = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));
const ALL_RECS = REC_ORDER.map((code) => RECS[code]).filter(Boolean);

/**
 * Combined Countries + RECs selector for the PAID form.
 * - User selects beneficiary countries first
 * - RECs are auto-preselected based on country membership
 * - User can add additional RECs manually
 */
export function PaidRecsField({ value, onChange, readOnly }: PaidRecsFieldProps) {
  const currentValue = value ?? { countries: [], recs: [] };
  const selectedCountries = currentValue.countries;
  const selectedRecs = currentValue.recs;

  // Derive RECs from selected countries
  const derivedRecs = useMemo(() => {
    const recSet = new Set<string>();
    for (const cc of selectedCountries) {
      const country = COUNTRIES[cc];
      if (country?.recs) {
        for (const rec of country.recs) {
          recSet.add(rec);
        }
      }
    }
    return Array.from(recSet);
  }, [selectedCountries]);

  // Auto-preselect RECs when countries change
  useEffect(() => {
    if (derivedRecs.length > 0) {
      const merged = new Set([...selectedRecs, ...derivedRecs]);
      if (merged.size !== selectedRecs.length) {
        onChange({ countries: selectedCountries, recs: Array.from(merged) });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedRecs.join(',')]);

  const toggleCountry = useCallback((code: string) => {
    if (readOnly) return;
    const next = selectedCountries.includes(code)
      ? selectedCountries.filter((c) => c !== code)
      : [...selectedCountries, code];
    onChange({ countries: next, recs: selectedRecs });
  }, [selectedCountries, selectedRecs, onChange, readOnly]);

  const toggleRec = useCallback((code: string) => {
    if (readOnly) return;
    const next = selectedRecs.includes(code)
      ? selectedRecs.filter((r) => r !== code)
      : [...selectedRecs, code];
    onChange({ countries: selectedCountries, recs: next });
  }, [selectedCountries, selectedRecs, onChange, readOnly]);

  const removeCountry = useCallback((code: string) => {
    if (readOnly) return;
    const nextCountries = selectedCountries.filter((c) => c !== code);
    onChange({ countries: nextCountries, recs: selectedRecs });
  }, [selectedCountries, selectedRecs, onChange, readOnly]);

  const removeRec = useCallback((code: string) => {
    if (readOnly) return;
    const nextRecs = selectedRecs.filter((r) => r !== code);
    onChange({ countries: selectedCountries, recs: nextRecs });
  }, [selectedCountries, selectedRecs, onChange, readOnly]);

  const [countryDropdownOpen, setCountryDropdownOpen] = React.useState(false);
  const [recDropdownOpen, setRecDropdownOpen] = React.useState(false);
  const [countrySearch, setCountrySearch] = React.useState('');

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return ALL_COUNTRIES;
    const q = countrySearch.toLowerCase();
    return ALL_COUNTRIES.filter((c) =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [countrySearch]);

  return (
    <div className="space-y-4">
      {/* 1. Beneficiary Countries */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
          Beneficiary Countries / Pays beneficiaires
        </label>

        {/* Selected countries chips */}
        {selectedCountries.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selectedCountries.map((cc) => {
              const c = COUNTRIES[cc];
              return (
                <span
                  key={cc}
                  className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                >
                  <span>{c?.flag}</span>
                  {c?.name ?? cc}
                  {!readOnly && (
                    <button onClick={() => removeCountry(cc)} className="ml-0.5 hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}

        {/* Dropdown */}
        {!readOnly && (
          <div className="relative">
            <button
              type="button"
              onClick={() => { setCountryDropdownOpen(!countryDropdownOpen); setRecDropdownOpen(false); }}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <span className="text-gray-400">
                {selectedCountries.length > 0
                  ? `${selectedCountries.length} country(ies) selected`
                  : 'Select beneficiary countries...'}
              </span>
              <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', countryDropdownOpen && 'rotate-180')} />
            </button>

            {countryDropdownOpen && (
              <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <div className="sticky top-0 border-b border-gray-100 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Search countries..."
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    autoFocus
                  />
                </div>
                {filteredCountries.map((c) => {
                  const selected = selectedCountries.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => toggleCountry(c.code)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800',
                        selected && 'bg-blue-50 dark:bg-blue-900/20',
                      )}
                    >
                      <input type="checkbox" checked={selected} readOnly className="h-3.5 w-3.5 rounded border-gray-300" />
                      <span>{c.flag}</span>
                      <span className="text-gray-700 dark:text-gray-300">{c.name}</span>
                      <span className="ml-auto text-[10px] text-gray-400">{c.code}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. RECs (auto-preselected + manual) */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
          Regional Economic Communities (RECs) / CER
        </label>

        {/* Selected RECs chips */}
        {selectedRecs.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selectedRecs.map((rc) => {
              const rec = RECS[rc];
              const isDerived = derivedRecs.includes(rc);
              return (
                <span
                  key={rc}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    isDerived
                      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
                      : 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
                  )}
                >
                  {rec?.name ?? rc.toUpperCase()}
                  {isDerived && <span className="text-[9px] text-green-500">(auto)</span>}
                  {!readOnly && (
                    <button onClick={() => removeRec(rc)} className="ml-0.5 hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}

        {/* RECs dropdown */}
        {!readOnly && (
          <div className="relative">
            <button
              type="button"
              onClick={() => { setRecDropdownOpen(!recDropdownOpen); setCountryDropdownOpen(false); }}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <span className="text-gray-400">
                {selectedRecs.length > 0
                  ? `${selectedRecs.length} REC(s) selected`
                  : 'Select RECs...'}
              </span>
              <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', recDropdownOpen && 'rotate-180')} />
            </button>

            {recDropdownOpen && (
              <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                {ALL_RECS.map((rec) => {
                  const selected = selectedRecs.includes(rec.code);
                  const isDerived = derivedRecs.includes(rec.code);
                  return (
                    <button
                      key={rec.code}
                      type="button"
                      onClick={() => toggleRec(rec.code)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800',
                        selected && 'bg-green-50 dark:bg-green-900/20',
                      )}
                    >
                      <input type="checkbox" checked={selected} readOnly className="h-3.5 w-3.5 rounded border-gray-300" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">{rec.name}</span>
                      <span className="ml-1 text-[10px] text-gray-400">{rec.fullName}</span>
                      {isDerived && <span className="ml-auto text-[9px] text-green-500">auto</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
