'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, Loader2 } from 'lucide-react';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { FormField, MultilingualText } from '../utils/form-schema';

interface UserSelectFieldProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  /** All form values — used to read the country from the linked admin-location field */
  formValues?: Record<string, unknown>;
}

/** Fetch users from credential API, optionally filtered by country code */
async function fetchUsers(countryCode?: string): Promise<Array<{ id: string; firstName: string; lastName: string; email: string; role: string; tenantCountryCode?: string }>> {
  const token = useAuthStore.getState().accessToken || '';
  const res = await fetch('/api/v1/credential/users?limit=100', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = await res.json();
  let users = (json?.data || []).map((u: any) => ({
    id: u.id,
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    email: u.email || '',
    role: u.role || '',
    tenantCountryCode: u.tenant?.countryCode?.toUpperCase() || '',
  }));
  // Filter by country code if provided
  if (countryCode) {
    const code = countryCode.toUpperCase();
    users = users.filter((u: any) => u.tenantCountryCode === code);
  }
  return users;
}

export function UserSelectField({ field, value, onChange, formValues }: UserSelectFieldProps) {
  const locale = useLocaleStore((s) => s.locale);
  const lang = locale?.slice(0, 2) ?? 'en';

  // Read the linked country field to filter users
  const countryFieldCode = (field.properties?.countryField as string) || 'destination_country';
  const countryValue = formValues?.[countryFieldCode];

  // Extract country code from admin-location value (which is { level_0: "KE" })
  let countryCode: string | undefined;
  if (typeof countryValue === 'string') {
    countryCode = countryValue;
  } else if (countryValue && typeof countryValue === 'object') {
    const loc = countryValue as Record<string, string>;
    countryCode = loc.level_0;
  }

  const { data: users, isLoading } = useQuery({
    queryKey: ['users-for-select', countryCode],
    queryFn: () => fetchUsers(countryCode),
    enabled: !!countryCode,
    staleTime: 60_000,
  });

  const label = field.label?.[lang] || field.label?.en || field.label?.fr || field.code;
  const helpText = field.helpText?.[lang] || field.helpText?.en || '';

  // Parse current value (stored as userId)
  const selectedUserId = typeof value === 'string' ? value : '';

  const userOptions = useMemo(() => {
    if (!users) return [];
    return users
      .filter((u) => u.firstName || u.lastName)
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
      .map((u) => ({
        id: u.id,
        label: `${u.firstName} ${u.lastName} (${u.email})`,
      }));
  }, [users]);

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        <span className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-gray-400" />
          {label}
          {field.required && <span className="text-red-500">*</span>}
        </span>
      </label>

      {!countryCode ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800">
          {lang === 'fr' ? 'Sélectionnez d\'abord un pays' : 'Select a country first'}
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800">
          <Loader2 className="h-4 w-4 animate-spin" />
          {lang === 'fr' ? 'Chargement des utilisateurs...' : 'Loading users...'}
        </div>
      ) : userOptions.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-600 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          {lang === 'fr' ? 'Aucun utilisateur trouvé pour ce pays' : 'No users found for this country'}
        </div>
      ) : (
        <select
          value={selectedUserId}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <option value="">
            {lang === 'fr' ? '— Sélectionner un destinataire —' : '— Select a recipient —'}
          </option>
          {userOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      )}

      {helpText && (
        <p className="mt-1 text-xs text-gray-400">{helpText}</p>
      )}
    </div>
  );
}
