'use client';

import React, { lazy, Suspense, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import type { FormField, MultilingualText, SelectOption, FieldCondition } from '../utils/form-schema';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { evaluateFieldCondition } from './ConditionEvaluator';
import {
  MapPin,
  Navigation,
  Upload,
  Image as ImageIcon,
  Pencil,
  Calculator,
  Fingerprint,
  Minus,
  Info,
  CircleHelp,
  Star,
} from 'lucide-react';

import { TranslatableTextField } from './TranslatableTextField';
import { MultiSearchCombobox } from '@/components/ui/MultiSearchCombobox';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

const GeoPointMap = lazy(() => import('./GeoPointMap').then((m) => ({ default: m.GeoPointMap })));
const GeoPolygonMap = lazy(() => import('./GeoPolygonMap').then((m) => ({ default: m.GeoPolygonMap })));
const AdminLocationField = lazy(() => import('./AdminLocationField').then((m) => ({ default: m.AdminLocationField })));
const MasterDataSelectField = lazy(() => import('./MasterDataSelectField').then((m) => ({ default: m.MasterDataSelectField })));
const RepeaterField = lazy(() => import('./RepeaterField').then((m) => ({ default: m.RepeaterField })));
const GeoSelectorField = lazy(() => import('./GeoSelectorField').then((m) => ({ default: m.GeoSelectorField })));
const MatrixField = lazy(() => import('./MatrixField').then((m) => ({ default: m.MatrixField })));
const CascadeSelectField = lazy(() => import('./CascadeSelectField').then((m) => ({ default: m.CascadeSelectField })));
const UserSelectField = lazy(() => import('./UserSelectField').then((m) => ({ default: m.UserSelectField })));
const DynamicBreakdownField = lazy(() => import('./DynamicBreakdownField').then((m) => ({ default: m.DynamicBreakdownField })));
const PaidRecsField = lazy(() => import('./PaidRecsField').then((m) => ({ default: m.PaidRecsField })));

interface FieldRendererProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Set another field's value (for auto-fill) */
  onAutoFill?: (fieldCode: string, value: unknown) => void;
  /** Cross-field validation error message */
  error?: string;
  /** All form values — used by geo-selector to center on selected country */
  formValues?: Record<string, unknown>;
}

/** Resolve multilingual text using current locale */
function useML() {
  const locale = useLocaleStore((s) => s.locale);
  const lang = locale?.slice(0, 2) ?? 'en';
  return (text?: MultilingualText) => {
    if (!text) return '';
    return text[lang] || text.en || text.fr || text.pt || Object.values(text).find((v) => v) || '';
  };
}

/**
 * Resolve dynamic references in parentFilter.
 * Values starting with "$" reference other form field codes.
 * e.g., { diseaseId: "$disease_name" } → { diseaseId: "actual-uuid-from-form" }
 */
function resolveParentFilter(
  filter: Record<string, string> | undefined,
  formValues?: Record<string, unknown>,
): Record<string, string> | undefined {
  if (!filter) return undefined;
  const resolved: Record<string, string> = {};
  for (const [key, val] of Object.entries(filter)) {
    if (val.startsWith('$') && formValues) {
      const fieldCode = val.slice(1);
      const formVal = formValues[fieldCode];
      if (formVal && typeof formVal === 'string') {
        resolved[key] = formVal;
      }
    } else {
      resolved[key] = val;
    }
  }
  // Only return if at least one key has a value
  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

export function FieldRenderer({ field, value, onChange, onAutoFill, error, formValues }: FieldRendererProps) {
  const t = useTranslations('collecte');
  const ml = useML();
  const label = ml(field.label);
  const placeholder = ml(field.placeholder);
  const helpText = ml(field.helpText);

  // Build parentFilter: merge explicit parentFilter with cascadeSource/cascadeParam from Properties Panel
  const effectiveParentFilter = useMemo(() => {
    const explicit = field.properties.parentFilter as Record<string, string> | undefined;
    if (explicit) return explicit;
    const cascadeSource = field.properties.cascadeSource as string | undefined;
    const cascadeParam = field.properties.cascadeParam as string | undefined;
    if (cascadeSource && cascadeParam) {
      // cascadeSource = field code of the parent field; build $reference for resolveParentFilter
      return { [cascadeParam]: `$${cascadeSource}` };
    }
    return undefined;
  }, [field.properties.parentFilter, field.properties.cascadeSource, field.properties.cascadeParam]);

  // Layout fields
  if (field.type === 'heading') {
    const level = (field.properties.level as string) || 'h3';
    const text = ml(field.properties.text as MultilingualText);
    const Tag = level as keyof JSX.IntrinsicElements;
    return <Tag className="text-lg font-semibold text-gray-900 dark:text-white">{text || label}</Tag>;
  }

  if (field.type === 'divider') {
    return <hr className="border-gray-200 dark:border-gray-700 my-2" />;
  }

  if (field.type === 'spacer') {
    return <div style={{ height: (field.properties.height as number) || 24 }} />;
  }

  if (field.type === 'info-box') {
    const text = ml(field.properties.text as MultilingualText);
    const boxType = (field.properties.type as string) || 'info';
    const colors: Record<string, string> = {
      info: 'bg-blue-50 border-blue-200 text-blue-700',
      warning: 'bg-amber-50 border-amber-200 text-amber-700',
      success: 'bg-green-50 border-green-200 text-green-700',
      error: 'bg-red-50 border-red-200 text-red-700',
    };
    return (
      <div className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', colors[boxType] || colors.info)}>
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>{text || label}</span>
      </div>
    );
  }

  // Wrapped input fields
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
            {field.required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
          {helpText && <FieldTooltip text={helpText} />}
        </div>
      )}

      {field.type === 'text' && (
        field.properties.translatable ? (
          <TranslatableTextField
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            readOnly={field.readOnly}
          />
        ) : (
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            readOnly={field.readOnly}
            className={inputClass}
          />
        )
      )}

      {field.type === 'email' && (
        <input
          type="email"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || t('fbEmailPlaceholder')}
          className={inputClass}
        />
      )}

      {field.type === 'phone' && (
        <input
          type="tel"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || t('fbPhonePlaceholder')}
          className={inputClass}
        />
      )}

      {field.type === 'url' && (
        <input
          type="url"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || t('fbUrlPlaceholder')}
          className={inputClass}
        />
      )}

      {field.type === 'textarea' && (
        field.properties.translatable ? (
          <TranslatableTextField
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            readOnly={field.readOnly}
            multiline
            rows={(field.properties.rows as number) || 4}
          />
        ) : (
          <textarea
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={(field.properties.rows as number) || 4}
            readOnly={field.readOnly}
            className={cn(inputClass, 'resize-y')}
          />
        )
      )}

      {field.type === 'number' && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder={placeholder}
            min={field.validation.min}
            max={field.validation.max}
            step={field.validation.step || (field.properties.step as number)}
            className={cn(inputClass, error && 'border-red-400 focus:border-red-500 focus:ring-red-400/30')}
          />
          {typeof field.properties.unit === 'string' && field.properties.unit && (
            <span className="text-sm text-gray-500 flex-shrink-0">{field.properties.unit}</span>
          )}
        </div>
      )}

      {field.type === 'select' && (
        <SearchableSelect
          value={(value as string) || ''}
          onChange={(v) => onChange(v)}
          options={((field.properties.options || []) as SelectOption[]).map((opt) => ({
            label: ml(opt.label) || opt.value,
            value: opt.value,
          }))}
          placeholder={placeholder || 'Select...'}
          disabled={field.readOnly}
        />
      )}

      {field.type === 'master-data-select' && (
        <Suspense fallback={
          <select className={inputClass} disabled>
            <option>{t('fbLoading')}</option>
          </select>
        }>
          <MasterDataSelectField
            masterDataType={(field.properties.masterDataType as string) || ''}
            value={field.properties.multiple ? (value as string | string[]) || [] : (value as string) || ''}
            onChange={(v) => onChange(v)}
            onItemSelected={onAutoFill && field.properties.autoFillFrom === undefined ? (item) => {
              // Auto-fill dependent fields based on autoFillField mappings in sibling fields
              if (!item || !onAutoFill) return;
              // Store full item metadata under a special key so other fields can read it
              onAutoFill(`__meta_${field.code}`, item);
            } : undefined}
            placeholder={placeholder}
            parentFilter={resolveParentFilter(
              effectiveParentFilter,
              formValues,
            )}
            className={inputClass}
            multiple={!!field.properties.multiple}
          />
        </Suspense>
      )}

      {field.type === 'dynamic-breakdown' && (
        <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}>
          <DynamicBreakdownField
            value={(value as Record<string, unknown>) || null}
            onChange={(v) => onChange(v)}
            paidActivityCode={
              resolveParentFilter(
                effectiveParentFilter,
                formValues,
              )?.paid_activity
            }
            readOnly={field.readOnly}
          />
        </Suspense>
      )}

      {field.type === 'paid-recs' && (
        <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}>
          <PaidRecsField
            value={(value as { countries: string[]; recs: string[] }) || null}
            onChange={(v) => onChange(v)}
            readOnly={field.readOnly}
          />
        </Suspense>
      )}

      {field.type === 'form-data-select' && (
        <FormDataSelectField field={field} value={value} onChange={onChange} placeholder={placeholder} ml={ml} />
      )}

      {field.type === 'multi-select' && (() => {
        const options = ((field.properties.options || []) as SelectOption[]);
        const selectedValues = Array.isArray(value) ? (value as string[]) : [];
        const selectedItems = options.filter((o) => selectedValues.includes(o.value));

        if (options.length === 0) {
          return (
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <span className="text-xs text-gray-400">{t('fbNoOptionsConfigured')}</span>
            </div>
          );
        }

        return (
          <MultiSearchCombobox<SelectOption>
            value={selectedItems}
            onChange={(items) => onChange(items.map((i) => i.value))}
            items={options}
            labelKey={(o) => ml(o.label) || o.value}
            idKey={(o) => o.value}
            filterKey={(o) => `${ml(o.label)} ${o.value}`}
            placeholder={placeholder || t('fbSelectOptions')}
            allLabel={t('all')}
            renderItem={(o) => (
              <span>{ml(o.label) || o.value}</span>
            )}
            renderChip={(o) => (
              <span>{ml(o.label) || o.value}</span>
            )}
          />
        );
      })()}

      {field.type === 'radio' && (
        <div className={cn('space-y-1', field.properties.layout === 'horizontal' && 'flex gap-4 space-y-0')}>
          {((field.properties.options || []) as SelectOption[]).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name={field.code}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className="border-gray-300"
              />
              {ml(opt.label) || opt.value}
            </label>
          ))}
        </div>
      )}

      {field.type === 'checkbox' && (() => {
        const selectedValues = Array.isArray(value) ? (value as string[]) : [];
        const maxSel = (field.properties.maxSelections as number) || 0;
        return (
          <div className="space-y-1">
            {((field.properties.options || []) as SelectOption[]).map((opt, i) => {
              const checked = selectedValues.includes(opt.value);
              const atMax = maxSel > 0 && selectedValues.length >= maxSel && !checked;
              return (
                <label key={i} className={cn('flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300', atMax && 'opacity-50')}>
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={checked}
                    disabled={field.readOnly || atMax}
                    onChange={() => {
                      const next = checked
                        ? selectedValues.filter((v) => v !== opt.value)
                        : [...selectedValues, opt.value];
                      onChange(next);
                    }}
                  />
                  {ml(opt.label) || opt.value}
                </label>
              );
            })}
          </div>
        );
      })()}

      {field.type === 'toggle' && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{ml(field.properties.labelOff as MultilingualText) || 'No'}</span>
          <button
            type="button"
            onClick={() => onChange(!value)}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              value ? 'bg-blue-500' : 'bg-gray-300',
            )}
          >
            <span className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              value ? 'translate-x-5' : 'translate-x-0.5',
            )} />
          </button>
          <span className="text-sm text-gray-500">{ml(field.properties.labelOn as MultilingualText) || 'Yes'}</span>
        </div>
      )}

      {field.type === 'rating' && (
        <div className="flex gap-1">
          {Array.from({ length: (field.properties.max as number) || 5 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i + 1)}
              className={cn(
                'h-8 w-8 rounded',
                (value as number) > i ? 'text-amber-400' : 'text-gray-300',
              )}
            >
              <Star className="h-6 w-6" fill={(value as number) > i ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
      )}

      {field.type === 'date' && (
        <DateFieldWithDefault field={field} value={value} onChange={onChange} error={error} />
      )}

      {field.type === 'time' && (
        <input
          type="time"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {field.type === 'datetime' && (
        <DateTimeFieldWithDefault field={field} value={value} onChange={onChange} />
      )}

      {field.type === 'date-range' && (() => {
        const rangeVal = (value && typeof value === 'object' ? value : {}) as { start?: string; end?: string };
        return (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={rangeVal.start || ''}
              onChange={(e) => onChange({ ...rangeVal, start: e.target.value })}
              className={cn(inputClass, 'flex-1')}
            />
            <span className="text-gray-400">—</span>
            <input
              type="date"
              value={rangeVal.end || ''}
              onChange={(e) => onChange({ ...rangeVal, end: e.target.value })}
              min={rangeVal.start || undefined}
              className={cn(inputClass, 'flex-1')}
            />
          </div>
        );
      })()}

      {field.type === 'admin-location' && (
        <Suspense fallback={
          <div className="h-32 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">{t('fbLoading')}</div>
        }>
          <AdminLocationField
            levels={(field.properties.levels as number[]) || [0, 1, 2]}
            requiredLevels={(field.properties.requiredLevels as number[]) || [0]}
            value={value && typeof value === 'object' ? value as Record<string, string> : null}
            onChange={(v) => onChange(v)}
            campaignTargetCountries={formValues?._campaignTargetCountries as string[] | undefined}
          />
        </Suspense>
      )}

      {field.type === 'geo-point' && (
        <Suspense fallback={
          <div className="h-48 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">{t('fbLoadingMap')}</div>
        }>
          <GeoPointMap
            value={value && typeof value === 'object' && 'lat' in (value as Record<string, unknown>)
              ? value as { lat: number; lng: number }
              : null
            }
            onChange={(v) => onChange(v)}
            showManualEntry={field.properties.allowManualEntry !== false}
            autoDetect={field.properties.autoDetect !== false}
          />
        </Suspense>
      )}

      {field.type === 'geo-polygon' && (
        <Suspense fallback={
          <div className="h-52 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">{t('fbLoadingMap')}</div>
        }>
          <GeoPolygonMap
            value={Array.isArray(value) ? value as Array<[number, number]> : null}
            onChange={(v) => onChange(v)}
            mode="polygon"
            maxPoints={(field.properties.maxPoints as number) || 50}
          />
        </Suspense>
      )}

      {field.type === 'geo-selector' && (
        <Suspense fallback={
          <div className="h-52 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">{t('fbLoadingMap')}</div>
        }>
          <GeoSelectorField
            value={value}
            onChange={onChange}
            modes={(field.properties.modes as Array<'point' | 'line' | 'polygon'>) || ['point', 'line', 'polygon']}
            defaultMode={(field.properties.defaultMode as 'point' | 'line' | 'polygon') || 'point'}
            countryCode={(() => {
              if (!formValues) return undefined;
              // Extract country code from the first admin-location field
              // Prefer origin_location, then admin_location, then any
              for (const key of ['origin_location', 'admin_location', ...Object.keys(formValues)]) {
                const v = formValues[key];
                if (v && typeof v === 'object' && 'level_0' in (v as Record<string, unknown>)) {
                  return (v as Record<string, string>).level_0;
                }
              }
              return undefined;
            })()}
          />
        </Suspense>
      )}

      {(field.type === 'file-upload' || field.type === 'image') && (
        <FileUploadField
          field={field}
          value={value}
          onChange={onChange}
          isImage={field.type === 'image'}
        />
      )}

      {field.type === 'signature' && (
        <SignatureField
          field={field}
          value={value}
          onChange={onChange}
        />
      )}

      {field.type === 'calculated' && (
        <CalculatedField field={field} value={value} onChange={onChange} formValues={formValues} />
      )}

      {field.type === 'auto-id' && (
        <AutoIdField field={field} value={value} onChange={onChange} />
      )}

      {field.type === 'repeater' && (
        <Suspense fallback={
          <div className="h-24 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">{t('fbLoading')}</div>
        }>
          <RepeaterField
            field={field}
            value={value}
            onChange={onChange}
            formValues={formValues}
          />
        </Suspense>
      )}

      {field.type === 'matrix' && (
        <Suspense fallback={
          <div className="h-24 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">{t('fbLoading')}</div>
        }>
          <MatrixField field={field} value={value} onChange={onChange} />
        </Suspense>
      )}

      {field.type === 'cascade-select' && (
        <Suspense fallback={
          <div className="h-20 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">{t('fbLoading')}</div>
        }>
          <CascadeSelectField field={field} value={value} onChange={onChange} />
        </Suspense>
      )}

      {field.type === 'user-select' && (
        <Suspense fallback={
          <div className="h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">{t('fbLoading')}</div>
        }>
          <UserSelectField field={field} value={value} onChange={onChange} formValues={formValues} />
        </Suspense>
      )}

      {field.type === 'conditional-group' && (
        <ConditionalGroupRenderer field={field} formValues={formValues || {}} onChange={onChange} />
      )}

      {field.type === 'lookup' && (
        <LookupField field={field} value={value} onChange={onChange} formValues={formValues} />
      )}

      {error && <FieldError message={error} />}

    </div>
  );
}

/* ── Tooltip component ────────────────────────────────────────────────────── */

function FieldTooltip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex">
      <CircleHelp className="h-3.5 w-3.5 text-gray-400 cursor-help transition-colors group-hover/tip:text-blue-500" />
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50',
          'w-max max-w-[220px] rounded-lg px-3 py-2',
          'bg-gray-900 dark:bg-gray-100 text-[11px] leading-relaxed',
          'text-gray-100 dark:text-gray-800 shadow-lg',
          'opacity-0 scale-95 transition-all duration-150',
          'group-hover/tip:opacity-100 group-hover/tip:scale-100',
          // Arrow
          'after:absolute after:top-full after:left-1/2 after:-translate-x-1/2',
          'after:border-4 after:border-transparent',
          'after:border-t-gray-900 dark:after:border-t-gray-100',
        )}
      >
        {text}
      </span>
    </span>
  );
}

/* ── Error message component ──────────────────────────────────────────────── */

function FieldError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-1.5 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-1.5 rounded-md bg-red-50 dark:bg-red-950/40 px-2.5 py-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
        <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zM8 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        {message}
      </div>
    </div>
  );
}

/* ── Conditional Group Renderer ──────────────────────────────────────────── */

function normalizeChildField(raw: Record<string, unknown>, index: number): FormField {
  return {
    id: (raw.id as string) || `child-${index}`,
    type: (raw.type as string) || 'text',
    code: (raw.code as string) || `field_${index}`,
    label: (raw.label as MultilingualText) || { en: `Field ${index}` },
    placeholder: (raw.placeholder as MultilingualText) || undefined,
    helpText: (raw.helpText as MultilingualText) || undefined,
    column: (raw.column as number) || 1,
    columnSpan: (raw.columnSpan as number) || 1,
    order: (raw.order as number) ?? index,
    required: (raw.required as boolean) ?? false,
    readOnly: (raw.readOnly as boolean) ?? false,
    hidden: (raw.hidden as boolean) ?? false,
    defaultValue: raw.defaultValue ?? null,
    validation: (raw.validation as FormField['validation']) || {},
    conditions: (raw.conditions as FormField['conditions']) || [],
    properties: (raw.properties as Record<string, unknown>) || {},
  };
}

function ConditionalGroupRenderer({
  field,
  formValues,
  onChange,
}: {
  field: FormField;
  formValues: Record<string, unknown>;
  onChange: (value: unknown) => void;
}) {
  // Evaluate the group's own conditions to decide whether to show children
  const conditions = field.conditions || [];
  const shouldShow = conditions.length === 0 || conditions.every((c) => {
    const result = evaluateFieldCondition(c, formValues);
    if (c.action === 'show') return result;
    if (c.action === 'hide') return !result;
    return true;
  });

  if (!shouldShow) return null;

  const children = (field.properties.children || []) as Array<Record<string, unknown>>;
  if (children.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600">
        <p className="text-xs text-gray-400">No child fields configured</p>
      </div>
    );
  }

  const childFields = children.map((c, i) => normalizeChildField(c, i));
  // Value for a conditional group is Record<childCode, childValue>
  const groupValue = (typeof field.properties._groupValue === 'object' ? field.properties._groupValue : formValues) as Record<string, unknown>;

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      {childFields
        .sort((a, b) => a.order - b.order)
        .map((child) => (
          <FieldRenderer
            key={child.id}
            field={child}
            value={groupValue[child.code]}
            onChange={(v) => {
              // Propagate to parent via a merged object
              const updated = { ...(typeof formValues === 'object' ? formValues : {}), [child.code]: v };
              onChange(updated);
            }}
            formValues={formValues}
          />
        ))}
    </div>
  );
}

/* ── Date field with defaultToToday ─────────────────────────────────────── */

function DateFieldWithDefault({ field, value, onChange, error }: { field: FormField; value: unknown; onChange: (v: unknown) => void; error?: string }) {
  const hasInit = React.useRef(false);
  React.useEffect(() => {
    if (!hasInit.current && !value && field.properties.defaultToToday) {
      hasInit.current = true;
      onChange(new Date().toISOString().slice(0, 10));
    }
  }, []);
  return (
    <input
      type="date"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputClass, error && 'border-red-400 focus:border-red-500 focus:ring-red-400/30')}
    />
  );
}

function DateTimeFieldWithDefault({ field, value, onChange }: { field: FormField; value: unknown; onChange: (v: unknown) => void }) {
  const hasInit = React.useRef(false);
  React.useEffect(() => {
    if (!hasInit.current && !value && field.properties.defaultToToday) {
      hasInit.current = true;
      onChange(new Date().toISOString().slice(0, 16));
    }
  }, []);
  return (
    <input
      type="datetime-local"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  );
}

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500';

/* ══════════════════════════════════════════════════════════════════════════
   FILE UPLOAD & IMAGE FIELD
   ══════════════════════════════════════════════════════════════════════════ */

interface FileInfo { id: string; name: string; url: string; size: number; mimeType: string }

function FileUploadField({
  field, value, onChange, isImage,
}: { field: FormField; value: unknown; onChange: (v: unknown) => void; isImage: boolean }) {
  const t = useTranslations('collecte');
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const files: FileInfo[] = Array.isArray(value) ? value as FileInfo[] : value ? [value as FileInfo] : [];
  const maxFiles = (field.properties.maxFiles as number) || (field.validation.maxFiles as number) || 5;
  const maxSizeMB = (field.properties.maxSize as number) || (field.validation.maxSize as number) || 10 * 1048576;
  const accept = (field.properties.accept as string) || (isImage ? 'image/*' : undefined);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;

    const newFiles: FileInfo[] = [];
    setUploading(true);
    setProgress(0);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size > maxSizeMB) {
        alert(`${file.name} exceeds ${Math.round(maxSizeMB / 1048576)}MB limit`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', `form-submissions/${field.code}`);

        const resp = await fetch('/api/v1/drive/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
          body: formData,
        });

        if (resp.ok) {
          const json = await resp.json();
          const uploaded = json.data || json;
          newFiles.push({
            id: uploaded.id || uploaded.fileId || crypto.randomUUID(),
            name: file.name,
            url: uploaded.url || uploaded.path || '',
            size: file.size,
            mimeType: file.type,
          });
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
      setProgress(Math.round(((i + 1) / fileList.length) * 100));
    }

    setUploading(false);
    const all = [...files, ...newFiles].slice(0, maxFiles);
    onChange(all.length === 1 ? all[0] : all);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    onChange(next.length === 0 ? null : next.length === 1 ? next[0] : next);
  };

  return (
    <div className="space-y-2">
      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={f.id || i} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
              {isImage && f.url && <img src={f.url} alt={f.name} className="h-10 w-10 rounded object-cover" />}
              <span className="flex-1 truncate text-sm">{f.name}</span>
              <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {files.length < maxFiles && (
        <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 hover:border-blue-400 transition-colors dark:border-gray-600 dark:hover:border-blue-500">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            multiple={maxFiles > 1}
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
          <div className="text-center">
            {uploading ? (
              <>
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <p className="mt-2 text-sm text-blue-500">{progress}%</p>
              </>
            ) : (
              <>
                {isImage ? <ImageIcon className="mx-auto h-8 w-8 text-gray-300" /> : <Upload className="mx-auto h-8 w-8 text-gray-300" />}
                <p className="mt-2 text-sm text-gray-500">{t('fbClickToUpload')}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {isImage ? 'PNG, JPG, GIF, WebP' : 'PDF, DOC, XLS, CSV, ZIP...'}
                  {' — max ' + Math.round(maxSizeMB / 1048576) + 'MB'}
                </p>
              </>
            )}
          </div>
        </label>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SIGNATURE FIELD — Canvas-based drawing
   ══════════════════════════════════════════════════════════════════════════ */

function SignatureField({
  field, value, onChange,
}: { field: FormField; value: unknown; onChange: (v: unknown) => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = React.useState(false);
  const [hasContent, setHasContent] = React.useState(!!value);
  const w = (field.properties.width as number) || 400;
  const h = (field.properties.height as number) || 200;
  const penColor = (field.properties.penColor as string) || '#1a1a1a';

  // Restore existing signature
  React.useEffect(() => {
    if (value && typeof value === 'string' && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);
      };
      img.src = value as string;
      setHasContent(true);
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    setDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasContent(true);
    }
  };

  const endDraw = () => {
    if (drawing) {
      setDrawing(false);
      // Save as base64 PNG
      if (canvasRef.current) {
        onChange(canvasRef.current.toDataURL('image/png'));
      }
    }
  };

  const clear = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, w, h);
      setHasContent(false);
      onChange(null);
    }
  };

  return (
    <div className="space-y-1">
      <div className="relative inline-block">
        <canvas
          ref={canvasRef}
          width={w}
          height={h}
          className="rounded-lg border-2 border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900 cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasContent && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Pencil className="mx-auto h-6 w-6 text-gray-300" />
              <p className="mt-1 text-xs text-gray-400">Sign here</p>
            </div>
          </div>
        )}
      </div>
      {hasContent && (
        <button type="button" onClick={clear} className="text-xs text-red-500 hover:text-red-700">
          Clear signature
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CALCULATED FIELD — evaluates simple formulas referencing other fields
   Formula syntax: {field_code} + {field_code} * 2
   Operators: + - * / ( )
   ══════════════════════════════════════════════════════════════════════════ */

function CalculatedField({
  field, value, onChange, formValues,
}: { field: FormField; value: unknown; onChange: (v: unknown) => void; formValues?: Record<string, unknown> }) {
  const formula = (field.properties.formula as string) || '';

  React.useEffect(() => {
    if (!formula || !formValues) return;

    // Replace {field_code} references with actual values
    let expr = formula.replace(/\{([^}]+)\}/g, (_, code: string) => {
      const v = formValues[code.trim()];
      const num = typeof v === 'number' ? v : parseFloat(String(v));
      return isNaN(num) ? '0' : String(num);
    });

    // Sanitize: only allow digits, operators, parentheses, dots
    expr = expr.replace(/[^0-9+\-*/().% ]/g, '');
    if (!expr.trim()) return;

    try {
      // Safe evaluation using Function (no eval)
      const result = new Function(`"use strict"; return (${expr})`)();
      const rounded = typeof result === 'number' && !isNaN(result)
        ? Math.round(result * 100) / 100
        : null;
      if (rounded !== value) {
        onChange(rounded);
      }
    } catch {
      // Invalid formula — keep current value
    }
  }, [formula, formValues]);

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
      <Calculator className="h-4 w-4 text-gray-400" />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {value !== null && value !== undefined ? String(value) : '—'}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   AUTO-ID FIELD — generates an ID when the form is first loaded
   Format: {prefix}{DATE}{SEQ} or {UUID}
   ══════════════════════════════════════════════════════════════════════════ */

function AutoIdField({
  field, value, onChange,
}: { field: FormField; value: unknown; onChange: (v: unknown) => void }) {
  const hasInit = React.useRef(false);

  React.useEffect(() => {
    if (hasInit.current || value) return;
    hasInit.current = true;

    const prefix = (field.properties.prefix as string) || '';
    const format = (field.properties.format as string) || '{SEQ}';
    const now = new Date();

    let id = `${prefix}${format}`;
    id = id.replace('{DATE}', now.toISOString().slice(0, 10).replace(/-/g, ''));
    id = id.replace('{YEAR}', String(now.getFullYear()));
    id = id.replace('{MONTH}', String(now.getMonth() + 1).padStart(2, '0'));
    id = id.replace('{UUID}', crypto.randomUUID().slice(0, 8).toUpperCase());
    id = id.replace('{SEQ}', String(Math.floor(Math.random() * 9000) + 1000));
    id = id.replace('{TS}', Date.now().toString(36).toUpperCase());

    onChange(id);
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
      <Fingerprint className="h-4 w-4 text-gray-400" />
      <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
        {(value as string) || '—'}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LOOKUP FIELD — resolves value from master-data based on a source field
   Properties: sourceField (field code), lookupType (master-data type),
   lookupField (which field to display from the resolved entity)
   ══════════════════════════════════════════════════════════════════════════ */

function LookupField({
  field, value, onChange, formValues,
}: { field: FormField; value: unknown; onChange: (v: unknown) => void; formValues?: Record<string, unknown> }) {
  const sourceField = (field.properties.sourceField as string) || '';
  const lookupField = (field.properties.lookupField as string) || 'name';
  const locale = useLocaleStore((s) => s.locale);

  const sourceValue = formValues?.[sourceField];

  React.useEffect(() => {
    if (!sourceValue || !sourceField) {
      if (value) onChange(null);
      return;
    }

    // Try to resolve from the __meta_ stored by master-data-select auto-fill
    const meta = formValues?.[`__meta_${sourceField}`] as Record<string, unknown> | undefined;
    if (meta) {
      const resolved = meta[lookupField];
      if (resolved !== undefined) {
        const display = typeof resolved === 'object' && resolved !== null
          ? (resolved as Record<string, string>)[locale] || (resolved as Record<string, string>).en || JSON.stringify(resolved)
          : String(resolved);
        if (display !== value) onChange(display);
        return;
      }
    }
  }, [sourceValue, formValues, sourceField, lookupField, locale]);

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {value ? String(value) : <span className="italic text-gray-400">—</span>}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FORM-DATA-SELECT — loads data from previous form submissions
   Properties: sourceFormId (template UUID), sourceFieldCode (field to show),
   valueFieldCode (field to use as value)
   ══════════════════════════════════════════════════════════════════════════ */

function FormDataSelectField({
  field, value, onChange, placeholder, ml,
}: { field: FormField; value: unknown; onChange: (v: unknown) => void; placeholder: string; ml: (t?: MultilingualText) => string }) {
  const [options, setOptions] = React.useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = React.useState(false);
  const sourceFormId = (field.properties.sourceFormId as string) || '';
  const sourceFieldCode = (field.properties.sourceFieldCode as string) || '';
  const valueFieldCode = (field.properties.valueFieldCode as string) || sourceFieldCode;

  React.useEffect(() => {
    if (!sourceFormId) return;
    setLoading(true);

    fetch(`/api/v1/collecte/submissions?templateId=${sourceFormId}&limit=200&status=SUBMITTED`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
    })
      .then((r) => r.json())
      .then((json) => {
        const items = (json.data || []) as Array<{ data: Record<string, unknown>; id: string }>;
        const opts = items
          .map((item) => {
            const label = String(item.data?.[sourceFieldCode] ?? item.id);
            const val = String(item.data?.[valueFieldCode] ?? item.id);
            return { value: val, label };
          })
          .filter((o) => o.label && o.value);
        // Deduplicate
        const seen = new Set<string>();
        setOptions(opts.filter((o) => { if (seen.has(o.value)) return false; seen.add(o.value); return true; }));
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [sourceFormId, sourceFieldCode, valueFieldCode]);

  return (
    <SearchableSelect
      value={(value as string) || ''}
      onChange={(v) => onChange(v)}
      options={options}
      placeholder={loading ? 'Loading...' : (placeholder || 'Select...')}
      disabled={field.readOnly || loading}
    />
  );
}
