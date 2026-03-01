'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminLevels, type AdminLevel } from '@/lib/api/settings-hooks';
import { useGeoEntities, useGeoChildren, type GeoEntity } from '@/lib/api/geo-hooks';
import { SearchCombobox } from '@/components/ui/SearchCombobox';
import { cn } from '@/lib/utils';

const LEVEL_MAP: Record<number, string> = {
  1: 'ADMIN1',
  2: 'ADMIN2',
  3: 'ADMIN3',
};

interface GeoLocationPickerProps {
  countryCode: string;
  countryId: string;
  value?: string | null;
  onChange?: (entityId: string | null, entity?: GeoEntity) => void;
  maxLevel?: number;
  disabled?: boolean;
  className?: string;
}

export function GeoLocationPicker({
  countryCode,
  countryId,
  value,
  onChange,
  maxLevel,
  disabled = false,
  className,
}: GeoLocationPickerProps) {
  const { data: adminLevelsData, isLoading: levelsLoading } = useAdminLevels(countryId, countryCode);
  const adminLevels: AdminLevel[] = useMemo(() => {
    const levels = adminLevelsData?.data ?? [];
    const sorted = [...levels].sort((a, b) => a.level - b.level);
    if (maxLevel) return sorted.filter((l) => l.level <= maxLevel);
    return sorted;
  }, [adminLevelsData, maxLevel]);

  // Track selected entity per level number
  const [selections, setSelections] = useState<Record<number, GeoEntity | null>>({});

  // When external value changes, we could resolve it — but for now
  // this is a controlled-from-parent simple picker, external value
  // is just the initial hint. Clearing is done through onChange(null).

  // Notify parent of deepest selection
  const notifyParent = useCallback(
    (newSelections: Record<number, GeoEntity | null>) => {
      if (!onChange) return;
      // Find the deepest non-null selection
      const sortedLevels = Object.keys(newSelections)
        .map(Number)
        .sort((a, b) => b - a);
      for (const lvl of sortedLevels) {
        if (newSelections[lvl]) {
          onChange(newSelections[lvl]!.id, newSelections[lvl]!);
          return;
        }
      }
      onChange(null);
    },
    [onChange],
  );

  const handleSelect = useCallback(
    (level: number, entity: GeoEntity | null) => {
      setSelections((prev) => {
        const updated: Record<number, GeoEntity | null> = { ...prev, [level]: entity };
        // Clear all deeper levels
        for (const al of adminLevels) {
          if (al.level > level) {
            updated[al.level] = null;
          }
        }
        // Defer parent notification
        setTimeout(() => notifyParent(updated), 0);
        return updated;
      });
    },
    [adminLevels, notifyParent],
  );

  if (levelsLoading) {
    return (
      <div className={cn('animate-pulse space-y-2', className)}>
        <div className="h-9 rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  if (adminLevels.length === 0) {
    return (
      <p className={cn('text-sm text-gray-400', className)}>
        No admin levels configured
      </p>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {adminLevels.map((al) => (
        <LevelCombobox
          key={al.level}
          adminLevel={al}
          countryCode={countryCode}
          parentEntity={al.level === 1 ? undefined : (selections[al.level - 1] ?? undefined)}
          value={selections[al.level] ?? null}
          onChange={(entity) => handleSelect(al.level, entity)}
          disabled={disabled || (al.level > 1 && !selections[al.level - 1])}
        />
      ))}
    </div>
  );
}

// ── Per-level combobox ────────────────────────────────────────────────────────

interface LevelComboboxProps {
  adminLevel: AdminLevel;
  countryCode: string;
  parentEntity?: GeoEntity;
  value: GeoEntity | null;
  onChange: (entity: GeoEntity | null) => void;
  disabled: boolean;
}

function LevelCombobox({
  adminLevel,
  countryCode,
  parentEntity,
  value,
  onChange,
  disabled,
}: LevelComboboxProps) {
  const levelNum = adminLevel.level;
  const geoLevel = LEVEL_MAP[levelNum];

  // Level 1-3: query by level + countryCode; Level 4+: query by parentId
  const useDirectQuery = levelNum <= 3 && !parentEntity;
  const directParams = useMemo(
    () =>
      useDirectQuery
        ? { level: geoLevel, countryCode, limit: 200 }
        : undefined,
    [useDirectQuery, geoLevel, countryCode],
  );

  // For level 1 we use direct query; for level 2-3 we can use either
  // (children is more precise); for 4+ we must use children
  const shouldUseChildren = levelNum > 1;
  const parentId = parentEntity?.id;

  const directQuery = useGeoEntities(
    !shouldUseChildren ? directParams : undefined,
  );
  const childrenQuery = useGeoChildren(
    shouldUseChildren ? parentId : undefined,
    shouldUseChildren && parentId ? { limit: 200 } : undefined,
  );

  const items: GeoEntity[] = shouldUseChildren
    ? (childrenQuery.data?.data ?? [])
    : (directQuery.data?.data ?? []);

  const isLoading = shouldUseChildren ? childrenQuery.isLoading : directQuery.isLoading;

  const labelFn = useCallback(
    (item: GeoEntity) => item.name?.en ?? item.code ?? item.id,
    [],
  );

  const levelLabel = adminLevel.name?.en ?? `Level ${levelNum}`;

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {levelLabel}
      </label>
      <SearchCombobox<GeoEntity>
        value={value}
        onChange={onChange}
        items={items}
        labelKey={labelFn}
        placeholder={disabled ? 'Select parent first...' : `Select ${levelLabel}...`}
        disabled={disabled}
        loading={isLoading}
      />
    </div>
  );
}
