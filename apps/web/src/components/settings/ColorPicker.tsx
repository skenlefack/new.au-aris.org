'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

const PRESET_COLORS = [
  '#003399', '#8B0000', '#006B3F', '#00308F', '#FF8C00',
  '#4B0082', '#DAA520', '#228B22', '#C62828', '#1565C0',
  '#00838F', '#E65100', '#2E7D32', '#F9A825', '#00695C',
  '#4527A0', '#D4A843', '#37474F',
];

export function ColorPicker({ label, value, onChange, disabled = false }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-1.5" ref={ref}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <div
            className="h-6 w-6 rounded-md border border-gray-300 shadow-sm dark:border-gray-600"
            style={{ backgroundColor: value }}
          />
          <span className="font-mono text-gray-700 dark:text-gray-300">{value}</span>
        </button>

        {open && (
          <div className="absolute left-0 top-full z-30 mt-1 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-2 grid grid-cols-6 gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); }}
                  className={cn(
                    'h-7 w-7 rounded-md border-2 transition-transform hover:scale-110',
                    value === c ? 'border-gray-900 dark:border-white' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-gray-100 pt-2 dark:border-gray-700">
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded border-0"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                    onChange(e.target.value);
                  }
                }}
                className="w-24 rounded border border-gray-200 px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="#000000"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
