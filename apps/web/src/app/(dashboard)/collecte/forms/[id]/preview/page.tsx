'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Monitor, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormBuilderTemplate } from '@/lib/api/form-builder-hooks';
import { FormRenderer } from '@/components/form-builder/renderer/FormRenderer';
import type { FormSchema } from '@/components/form-builder/utils/form-schema';

export default function FormPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params?.id as string;
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');

  const { data, isLoading } = useFormBuilderTemplate(formId);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const template = data?.data;
  if (!template) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Form not found</p>
      </div>
    );
  }

  const schema = (template.schema && typeof template.schema === 'object' && 'sections' in (template.schema as object))
    ? template.schema as FormSchema
    : { sections: [], settings: {} as FormSchema['settings'] };

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

      {/* Preview */}
      <div className="rounded-xl bg-gray-50 p-8 dark:bg-gray-800/30">
        <div className={cn('mx-auto', mode === 'mobile' ? 'max-w-sm' : 'max-w-3xl')}>
          <FormRenderer schema={schema} formName={template.name} />
        </div>
      </div>
    </div>
  );
}
