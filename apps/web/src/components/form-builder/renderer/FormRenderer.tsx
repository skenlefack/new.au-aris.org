'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormSchema, FormSection, FormField } from '../utils/form-schema';
import { FieldRenderer } from './FieldRenderer';

interface FormRendererProps {
  schema: FormSchema;
  formName: string;
  onSubmit?: (data: Record<string, unknown>) => void;
}

export function FormRenderer({ schema, formName, onSubmit }: FormRendererProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const handleFieldChange = (fieldCode: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldCode]: value }));
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{formName}</h1>
      </div>

      {schema.sections
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            values={values}
            onChange={handleFieldChange}
            isCollapsed={collapsedSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
        ))}

      {onSubmit && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Save Draft
          </button>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Submit
          </button>
        </div>
      )}
    </form>
  );
}

function SectionRenderer({
  section,
  values,
  onChange,
  isCollapsed,
  onToggle,
}: {
  section: FormSection;
  values: Record<string, unknown>;
  onChange: (code: string, value: unknown) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const sectionName = section.name.en || section.name.fr || 'Section';

  return (
    <div
      className="rounded-xl border bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700"
      style={section.color ? { borderTopColor: section.color, borderTopWidth: 3 } : undefined}
    >
      {/* Section Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 cursor-pointer select-none"
        onClick={section.isCollapsible ? onToggle : undefined}
      >
        {section.isCollapsible && (
          isCollapsed
            ? <ChevronRight className="h-5 w-5 text-gray-400" />
            : <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{sectionName}</h2>
          {section.description?.en && (
            <p className="text-xs text-gray-500 mt-0.5">{section.description.en}</p>
          )}
        </div>
      </div>

      {/* Section Fields */}
      {!isCollapsed && (
        <div className="px-6 pb-6">
          <div
            className={cn(
              'grid gap-4',
              section.columns === 1 && 'grid-cols-1',
              section.columns === 2 && 'grid-cols-1 md:grid-cols-2',
              section.columns === 3 && 'grid-cols-1 md:grid-cols-3',
              section.columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
            )}
          >
            {section.fields
              .sort((a, b) => a.order - b.order)
              .filter((f) => !f.hidden)
              .map((field) => (
                <div
                  key={field.id}
                  className={cn(
                    field.columnSpan === 2 && 'md:col-span-2',
                    field.columnSpan === 3 && 'md:col-span-3',
                    field.columnSpan === 4 && 'md:col-span-4',
                  )}
                >
                  <FieldRenderer
                    field={field}
                    value={values[field.code]}
                    onChange={(v) => onChange(field.code, v)}
                  />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
