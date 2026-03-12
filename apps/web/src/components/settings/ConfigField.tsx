'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ColorPicker } from './ColorPicker';

interface ConfigFieldProps {
  label: string;
  description?: string;
  type: string;        // "string" | "number" | "boolean" | "color" | "url" | "enum" | "json"
  value: unknown;
  onChange: (value: unknown) => void;
  options?: string[];  // for enum type
  disabled?: boolean;
}

export function ConfigField({
  label,
  description,
  type,
  value,
  onChange,
  options,
  disabled = false,
}: ConfigFieldProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>

      <div className="shrink-0">
        {type === 'boolean' && (
          <ToggleSwitch
            checked={value === true}
            onChange={(v) => onChange(v)}
            disabled={disabled}
          />
        )}

        {type === 'string' && (
          <input
            type="text"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={cn(
              'w-64 rounded-lg border border-gray-200 px-3 py-1.5 text-sm',
              'focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500',
              'dark:border-gray-700 dark:bg-gray-900 dark:text-white',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
        )}

        {type === 'secret' && (
          <input
            type="password"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="••••••••"
            autoComplete="off"
            className={cn(
              'w-64 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-mono',
              'focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500',
              'dark:border-gray-700 dark:bg-gray-900 dark:text-white',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
        )}

        {type === 'number' && (
          <input
            type="number"
            value={(value as number) ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
            className={cn(
              'w-32 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-right',
              'focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500',
              'dark:border-gray-700 dark:bg-gray-900 dark:text-white',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
        )}

        {type === 'url' && (
          <input
            type="url"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="https://..."
            className={cn(
              'w-72 rounded-lg border border-gray-200 px-3 py-1.5 text-sm',
              'focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500',
              'dark:border-gray-700 dark:bg-gray-900 dark:text-white',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
        )}

        {type === 'color' && (
          <ColorPicker
            label=""
            value={(value as string) ?? '#000000'}
            onChange={(c) => onChange(c)}
            disabled={disabled}
          />
        )}

        {type === 'enum' && options && (
          <select
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={cn(
              'w-48 rounded-lg border border-gray-200 px-3 py-1.5 text-sm',
              'focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500',
              'dark:border-gray-700 dark:bg-gray-900 dark:text-white',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}

        {type === 'json' && (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try { onChange(JSON.parse(e.target.value)); } catch { onChange(e.target.value); }
            }}
            disabled={disabled}
            rows={3}
            className={cn(
              'w-72 rounded-lg border border-gray-200 px-3 py-1.5 font-mono text-xs',
              'focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500',
              'dark:border-gray-700 dark:bg-gray-900 dark:text-white',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
        )}
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        checked ? 'bg-aris-primary-600' : 'bg-gray-200 dark:bg-gray-700',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}
