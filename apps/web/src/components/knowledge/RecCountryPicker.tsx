'use client';

// Cascading REC → Country picker built on top of the live tenant directory.
// Used by the category and publication forms so continental editors can target
// any REC or member state without typing UUIDs.
//
// - When `mode="rec"` only the REC select is rendered; the value emitted is
//   the REC tenant id.
// - When `mode="country"` both selects are rendered; the country tenant id is
//   the primary value and the parent REC tenant id is exposed as `recParentId`
//   so the form can populate `recParentTenantId` on the category payload.

import { useMemo } from 'react';
import { useAllTenants, type TenantSummary } from '@/lib/api/knowledge-hub-hooks';

interface BaseProps {
  recTenantId: string | null;
  onRecChange: (id: string | null) => void;
  disabled?: boolean;
}

interface RecModeProps extends BaseProps {
  mode: 'rec';
}

interface CountryModeProps extends BaseProps {
  mode: 'country';
  countryTenantId: string | null;
  onCountryChange: (id: string | null) => void;
}

type Props = RecModeProps | CountryModeProps;

export function RecCountryPicker(props: Props) {
  const { data, isLoading } = useAllTenants();
  const tenants: TenantSummary[] = data?.data ?? [];

  const recs = useMemo(
    () =>
      tenants
        .filter((t) => t.level === 'REC')
        .sort((a, b) => a.code.localeCompare(b.code)),
    [tenants],
  );

  const countriesInRec = useMemo(() => {
    if (props.mode !== 'country' || !props.recTenantId) return [];
    return tenants
      .filter((t) => t.level === 'MEMBER_STATE' && t.parentId === props.recTenantId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tenants, props]);

  return (
    <div className="space-y-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Regional Economic Community (REC)
        </label>
        <select
          value={props.recTenantId ?? ''}
          onChange={(e) => {
            const v = e.target.value || null;
            props.onRecChange(v);
            if (props.mode === 'country') props.onCountryChange(null);
          }}
          disabled={props.disabled || isLoading}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">{isLoading ? 'Loading…' : '— pick a REC —'}</option>
          {recs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.code})
            </option>
          ))}
        </select>
      </div>

      {props.mode === 'country' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Member state
          </label>
          <select
            value={props.countryTenantId ?? ''}
            onChange={(e) => props.onCountryChange(e.target.value || null)}
            disabled={props.disabled || !props.recTenantId || countriesInRec.length === 0}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">
              {!props.recTenantId
                ? '— pick a REC first —'
                : countriesInRec.length === 0
                  ? 'No countries found'
                  : '— pick a member state —'}
            </option>
            {countriesInRec.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.countryCode ? ` (${c.countryCode})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
