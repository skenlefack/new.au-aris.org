'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Monitor, Smartphone, Layers, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormBuilderTemplate, useResolvedForm } from '@/lib/api/form-builder-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { FormRenderer } from '@/components/form-builder/renderer/FormRenderer';
import type { FormSchema, FormSection, FormField } from '@/components/form-builder/utils/form-schema';

export default function FormPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params?.id as string;
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showResolved, setShowResolved] = useState(false);

  const userRole = useAuthStore((s) => s.user?.role);
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const selectedTenantId = useTenantStore((s) => s.selectedTenantId);
  const effectiveTenantId = tenantId ?? selectedTenantId ?? '';

  const canOverlay = userRole === 'REC_ADMIN' || userRole === 'NATIONAL_ADMIN';

  const { data, isLoading } = useFormBuilderTemplate(formId);
  const {
    data: resolvedData,
    isLoading: resolvedLoading,
  } = useResolvedForm(
    canOverlay ? formId : undefined,
    canOverlay ? effectiveTenantId : undefined,
  );

  const template = data?.data;

  const baseSchema = useMemo((): FormSchema => {
    if (!template) return { sections: [], settings: {} as FormSchema['settings'] };
    if (template.schema && typeof template.schema === 'object' && 'sections' in (template.schema as object)) {
      return template.schema as FormSchema;
    }
    return { sections: [], settings: {} as FormSchema['settings'] };
  }, [template]);

  // Build resolved schema by merging custom fields into base sections
  const resolvedSchema = useMemo((): FormSchema => {
    const resolved = resolvedData?.data;
    if (!resolved || !showResolved) return baseSchema;

    const resolvedSections = resolved.resolvedSections as FormSection[] | undefined;
    if (resolvedSections && resolvedSections.length > 0) {
      return { sections: resolvedSections, settings: baseSchema.settings };
    }

    // Fallback: merge resolved fields into base schema sections
    const resolvedFields = resolved.resolvedFields as FormField[] | undefined;
    if (!resolvedFields) return baseSchema;

    // Find fields that are in resolved but not in base (custom fields)
    const baseFieldIds = new Set(
      baseSchema.sections.flatMap((s) => s.fields.map((f) => f.id)),
    );
    const customFields = resolvedFields.filter((f) => !baseFieldIds.has(f.id));

    if (customFields.length === 0) return baseSchema;

    // Append custom fields to the last section with a marker property
    const sections = baseSchema.sections.map((s, i) => {
      if (i === baseSchema.sections.length - 1) {
        return {
          ...s,
          fields: [
            ...s.fields,
            ...customFields.map((cf) => ({
              ...cf,
              properties: { ...cf.properties, _isCustomOverlay: true },
            })),
          ],
        };
      }
      return s;
    });

    return { sections, settings: baseSchema.settings };
  }, [baseSchema, resolvedData, showResolved]);

  const activeSchema = showResolved ? resolvedSchema : baseSchema;
  const hasOverlays = (resolvedData?.data?.appliedOverlays?.length ?? 0) > 0;

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Form not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/collecte/forms')}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Preview: {template.name}
            </h1>
            <p className="text-xs text-gray-500">v{template.version} — {template.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Resolved form toggle — only for overlay-capable roles */}
          {canOverlay && hasOverlays && (
            <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
              <button
                onClick={() => setShowResolved(false)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium',
                  !showResolved
                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-white'
                    : 'text-gray-500',
                )}
              >
                <Eye className="h-3.5 w-3.5" /> Continental only
              </button>
              <button
                onClick={() => setShowResolved(true)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium',
                  showResolved
                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : 'text-gray-500',
                )}
              >
                <Layers className="h-3.5 w-3.5" /> With tenant fields
                {resolvedLoading && (
                  <div className="ml-1 h-3 w-3 animate-spin rounded-full border border-indigo-500 border-t-transparent" />
                )}
              </button>
            </div>
          )}

          {/* Desktop / Mobile toggle */}
          <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
            <button
              onClick={() => setMode('desktop')}
              className={cn(
                'flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium',
                mode === 'desktop'
                  ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-white'
                  : 'text-gray-500',
              )}
            >
              <Monitor className="h-3.5 w-3.5" /> Desktop
            </button>
            <button
              onClick={() => setMode('mobile')}
              className={cn(
                'flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium',
                mode === 'mobile'
                  ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-white'
                  : 'text-gray-500',
              )}
            >
              <Smartphone className="h-3.5 w-3.5" /> Mobile
            </button>
          </div>
        </div>
      </div>

      {/* Legend when showing resolved */}
      {showResolved && hasOverlays && (
        <div className="flex items-center gap-4 rounded-lg border border-indigo-100 bg-indigo-50/50 px-4 py-2 dark:border-indigo-800 dark:bg-indigo-900/10">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span className="inline-block h-3 w-1 rounded-full bg-gray-300" />
            Continental fields
          </div>
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400">
            <span className="inline-block h-3 w-1 rounded-full bg-indigo-500" />
            Custom tenant fields
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="rounded-xl bg-gray-50 p-8 dark:bg-gray-800/30">
        <div className={cn('mx-auto', mode === 'mobile' && 'max-w-sm')}>
          <FormRenderer schema={activeSchema} formName={template.name} mobile={mode === 'mobile'} />
        </div>
      </div>
    </div>
  );
}
