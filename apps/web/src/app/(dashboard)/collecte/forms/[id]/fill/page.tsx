'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  useFormBuilderTemplate,
  useCreateSubmission,
  useEffectiveForm,
  type FormTemplateListItem,
} from '@/lib/api/form-builder-hooks';
import { FormRenderer } from '@/components/form-builder/renderer/FormRenderer';
import type { ExtensionFieldDef } from '@/components/form-builder/renderer/FormRenderer';
import { Skeleton } from '@/components/ui/Skeleton';
import type { FormSchema } from '@/components/form-builder/utils/form-schema';
import { useTranslations } from '@/lib/i18n/translations';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTenantStore } from '@/lib/stores/tenant-store';

function extractSchema(tpl: FormTemplateListItem | undefined): FormSchema | null {
  if (!tpl?.schema) return null;
  if (typeof tpl.schema === 'object' && 'sections' in (tpl.schema as object)) {
    return tpl.schema as FormSchema;
  }
  return null;
}

export default function FormFillPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('collecte');

  const templateId = params.id as string;
  const campaignId = searchParams?.get('campaignId') ?? undefined;
  const returnTo = searchParams?.get('returnTo') ?? '/collecte/forms';

  const user = useAuthStore((s) => s.user);
  const selectedTenant = useTenantStore((s) => s.selectedTenant);
  const tenantId = user?.tenantId ?? selectedTenant?.id;

  const { data: templateRes, isLoading } = useFormBuilderTemplate(templateId);
  const submitMutation = useCreateSubmission();

  // Fetch effective form (base + extension) when in campaign context
  const { data: effectiveData } = useEffectiveForm(campaignId, templateId, tenantId);

  const [submitted, setSubmitted] = useState(false);

  const template = templateRes?.data;
  const schema = extractSchema(template);
  const templateName = template?.name ?? 'Form';

  // Map effective form extension fields to ExtensionFieldDef[]
  const extensionFields = useMemo<ExtensionFieldDef[]>(() => {
    if (!effectiveData?.extensionFields?.length) return [];
    return effectiveData.extensionFields.map((ef) => ({
      id: ef.id,
      fieldKey: ef.fieldKey,
      label: ef.label as Record<string, string>,
      type: ef.type,
      required: ef.required,
      order: ef.order,
      properties: ef.properties as Record<string, unknown> | null,
      referenceDataId: ef.referenceDataId,
      validation: ef.validation,
    }));
  }, [effectiveData]);

  const handleSubmit = async (formData: Record<string, unknown>) => {
    try {
      await submitMutation.mutateAsync({
        templateId,
        data: formData,
        status: 'SUBMITTED',
        ...(campaignId ? { campaignId } : {}),
        ...(effectiveData?.extension ? { extensionId: effectiveData.extension.id } : {}),
      });
      setSubmitted(true);
    } catch {
      // Error shown via mutation state
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
        <p className="mt-3 text-sm text-gray-500">Form template not found or has no schema.</p>
        <Link href={returnTo} className="mt-4 inline-block text-sm font-medium text-red-600 hover:text-red-700">
          Go back
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-4xl py-16 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
        <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{t('submissionSuccess')}</h2>
        <p className="mt-2 text-sm text-gray-500">{t('submissionSuccessDesc')}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => { setSubmitted(false); }}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
          >
            {t('submitAnother')}
          </button>
          <Link
            href={returnTo}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            {t('backToDomain')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={returnTo}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{templateName}</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{t('fillFormDesc')}</p>
        </div>
      </div>

      {submitMutation.error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {submitMutation.error instanceof Error ? submitMutation.error.message : 'Submission failed'}
        </div>
      )}

      <FormRenderer
        schema={schema}
        formName={templateName}
        onSubmit={handleSubmit}
        extensionFields={extensionFields.length > 0 ? extensionFields : undefined}
      />
    </div>
  );
}
