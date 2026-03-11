'use client';

import React, { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import type { FormField, MultilingualText, SelectOption } from '../utils/form-schema';
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

const GeoPointMap = lazy(() => import('./GeoPointMap').then((m) => ({ default: m.GeoPointMap })));
const GeoPolygonMap = lazy(() => import('./GeoPolygonMap').then((m) => ({ default: m.GeoPolygonMap })));
const AdminLocationField = lazy(() => import('./AdminLocationField').then((m) => ({ default: m.AdminLocationField })));
const MasterDataSelectField = lazy(() => import('./MasterDataSelectField').then((m) => ({ default: m.MasterDataSelectField })));
const RepeaterField = lazy(() => import('./RepeaterField').then((m) => ({ default: m.RepeaterField })));
const GeoSelectorField = lazy(() => import('./GeoSelectorField').then((m) => ({ default: m.GeoSelectorField })));

interface FieldRendererProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Cross-field validation error message */
  error?: string;
}

const ml = (text?: MultilingualText) => text?.en || text?.fr || '';

export function FieldRenderer({ field, value, onChange, error }: FieldRendererProps) {
  const label = ml(field.label);
  const placeholder = ml(field.placeholder);
  const helpText = ml(field.helpText);

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
        <input
          type="text"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={field.readOnly}
          className={inputClass}
        />
      )}

      {field.type === 'email' && (
        <input
          type="email"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'email@example.com'}
          className={inputClass}
        />
      )}

      {field.type === 'phone' && (
        <input
          type="tel"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || '+1 234 567 8900'}
          className={inputClass}
        />
      )}

      {field.type === 'url' && (
        <input
          type="url"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'https://...'}
          className={inputClass}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={(field.properties.rows as number) || 4}
          className={cn(inputClass, 'resize-y')}
        />
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
        <select
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">{placeholder || 'Select...'}</option>
          {((field.properties.options || []) as SelectOption[]).map((opt, i) => (
            <option key={i} value={opt.value}>
              {ml(opt.label) || opt.value}
            </option>
          ))}
        </select>
      )}

      {field.type === 'master-data-select' && (
        <Suspense fallback={
          <select className={inputClass} disabled>
            <option>Loading...</option>
          </select>
        }>
          <MasterDataSelectField
            masterDataType={(field.properties.masterDataType as string) || ''}
            value={(value as string) || ''}
            onChange={(v) => onChange(v)}
            placeholder={placeholder}
            className={inputClass}
          />
        </Suspense>
      )}

      {field.type === 'form-data-select' && (
        <select
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">{placeholder || 'Select...'}</option>
        </select>
      )}

      {field.type === 'multi-select' && (
        <div className="space-y-1 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
          {((field.properties.options || []) as SelectOption[]).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" className="rounded border-gray-300" />
              {ml(opt.label) || opt.value}
            </label>
          ))}
          {((field.properties.options || []) as SelectOption[]).length === 0 && (
            <span className="text-xs text-gray-400">No options configured</span>
          )}
        </div>
      )}

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

      {field.type === 'checkbox' && (
        <div className="space-y-1">
          {((field.properties.options || []) as SelectOption[]).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" className="rounded border-gray-300" />
              {ml(opt.label) || opt.value}
            </label>
          ))}
        </div>
      )}

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
        <input
          type="date"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, error && 'border-red-400 focus:border-red-500 focus:ring-red-400/30')}
        />
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
        <input
          type="datetime-local"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {field.type === 'date-range' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className={cn(inputClass, 'flex-1')}
            placeholder="Start"
          />
          <span className="text-gray-400">—</span>
          <input
            type="date"
            className={cn(inputClass, 'flex-1')}
            placeholder="End"
          />
        </div>
      )}

      {field.type === 'admin-location' && (
        <Suspense fallback={
          <div className="h-32 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">Loading...</div>
        }>
          <AdminLocationField
            levels={(field.properties.levels as number[]) || [0, 1, 2]}
            requiredLevels={(field.properties.requiredLevels as number[]) || [0]}
            value={value && typeof value === 'object' ? value as Record<string, string> : null}
            onChange={(v) => onChange(v)}
          />
        </Suspense>
      )}

      {field.type === 'geo-point' && (
        <Suspense fallback={
          <div className="h-48 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">Loading map...</div>
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
          <div className="h-52 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">Loading map...</div>
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
          <div className="h-52 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">Loading map...</div>
        }>
          <GeoSelectorField
            value={value}
            onChange={onChange}
            modes={(field.properties.modes as Array<'point' | 'line' | 'polygon'>) || ['point', 'line', 'polygon']}
            defaultMode={(field.properties.defaultMode as 'point' | 'line' | 'polygon') || 'point'}
          />
        </Suspense>
      )}

      {(field.type === 'file-upload' || field.type === 'image') && (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 dark:border-gray-600">
          <div className="text-center">
            {field.type === 'image' ? <ImageIcon className="mx-auto h-8 w-8 text-gray-300" /> : <Upload className="mx-auto h-8 w-8 text-gray-300" />}
            <p className="mt-2 text-sm text-gray-500">
              Click to upload or drag & drop
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {field.type === 'image' ? 'PNG, JPG, GIF' : 'Any file type'}
              {field.validation.maxSize && ` up to ${Math.round(field.validation.maxSize / 1048576)}MB`}
            </p>
          </div>
        </div>
      )}

      {field.type === 'signature' && (
        <div
          className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center"
          style={{
            width: (field.properties.width as number) || 400,
            height: (field.properties.height as number) || 200,
          }}
        >
          <div className="text-center">
            <Pencil className="mx-auto h-6 w-6 text-gray-300" />
            <p className="mt-1 text-xs text-gray-400">Sign here</p>
          </div>
        </div>
      )}

      {field.type === 'calculated' && (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
          <Calculator className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500 italic">
            {(field.properties.formula as string) || 'No formula set'}
          </span>
        </div>
      )}

      {field.type === 'auto-id' && (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
          <Fingerprint className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-mono text-gray-500">
            {(field.properties.prefix as string) || ''}{(field.properties.format as string) || '{SEQ}'}
          </span>
        </div>
      )}

      {field.type === 'repeater' && (
        <Suspense fallback={
          <div className="h-24 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">Loading...</div>
        }>
          <RepeaterField
            field={field}
            value={value}
            onChange={onChange}
          />
        </Suspense>
      )}

      {field.type === 'matrix' && (
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700 overflow-x-auto">
          <p className="text-xs text-gray-400 mb-2">Matrix / Grid input</p>
          <div className="h-20 rounded bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-400">
            Matrix cells appear here
          </div>
        </div>
      )}

      {field.type === 'cascade-select' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Cascade chain</p>
          <select className={inputClass}><option>Level 1...</option></select>
          <select className={inputClass}><option>Level 2...</option></select>
        </div>
      )}

      {field.type === 'conditional-group' && (
        <div className="rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600">
          <p className="text-xs text-gray-400">Conditional fields appear here when condition is met</p>
        </div>
      )}

      {field.type === 'lookup' && (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
          <span className="text-sm text-gray-500 italic">Lookup value</span>
        </div>
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

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500';
