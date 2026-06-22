'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertCircle, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useSubmission } from '@/lib/api/hooks';
import { useUpdateSubmissionData } from '@/lib/api/workflow-hooks';
import { useFormBuilderTemplate } from '@/lib/api/form-builder-hooks';
import { FormRenderer } from '@/components/form-builder/renderer/FormRenderer';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import type { FormSchema } from '@/components/form-builder/utils/form-schema';

function extractSchema(tpl: any): FormSchema | null {
  const schema = tpl?.schema;
  if (!schema) return null;
  if (typeof schema === 'object' && 'sections' in schema) {
    return schema as FormSchema;
  }
  return null;
}

export default function SubmissionEditPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('collecte');
  const id = params.id as string;

  const { data: subRes, isLoading: subLoading } = useSubmission(id);
  const submission = subRes?.data;

  const templateId = submission?.templateId;
  const { data: templateRes, isLoading: templateLoading } = useFormBuilderTemplate(templateId);
  const template = (templateRes as any)?.data;
  const schema = extractSchema(template);

  const updateMutation = useUpdateSubmissionData();

  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pre-fill values from existing submission data
  const initialValues = useMemo(() => {
    if (!submission) return {};
    const data = (submission as any).data ?? (submission as any).formData ?? {};
    return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  }, [submission]);

  const isLoading = subLoading || templateLoading;

  if (isLoading) return <DetailSkeleton />;

  if (!submission) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <Link
          href="/collecte"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToCampaigns')}
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500">
          Submission not found
        </div>
      </div>
    );
  }

  // Guard: only RETURNED or REJECTED submissions can be edited
  const status = (submission.status ?? '').toUpperCase();
  const canEdit = status === 'RETURNED' || status === 'REJECTED';

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <Link
          href={`/collecte/submissions/${id}/review`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Review
        </Link>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{t('onlyReturnedCanEdit')}</h2>
          </div>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            Current status: <strong>{status}</strong>
          </p>
        </div>
      </div>
    );
  }

  const templateName = template?.name ?? `Template ${(templateId ?? '').slice(0, 8)}`;

  const handleSubmit = async (formData: Record<string, unknown>) => {
    setBanner(null);
    try {
      await updateMutation.mutateAsync({ id, data: formData });
      setBanner({ type: 'success', message: t('submissionCreated') });
      setTimeout(() => {
        router.push(`/collecte/submissions/${id}/review`);
      }, 1200);
    } catch (err: any) {
      let msg = err?.message || 'Failed to update submission';
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.message) msg = parsed.message;
      } catch {
        // plain string
      }
      setBanner({ type: 'error', message: msg });
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 pb-12">
      {/* Header */}
      <div>
        <Link
          href={`/collecte/submissions/${id}/review`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Review
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Edit3 className="h-6 w-6 text-orange-500" />
              {t('editSubmission')}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('editSubmissionDesc')}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
            <Edit3 className="h-3.5 w-3.5" />
            {status}
          </span>
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm',
            banner.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300',
          )}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {banner.message}
        </div>
      )}

      {/* Form */}
      {schema ? (
        <FormRenderer
          schema={schema}
          formName={templateName}
          isSubmitting={updateMutation.isPending}
          onSubmit={handleSubmit}
          initialValues={initialValues}
          submitLabel={t('resubmit')}
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <AlertCircle className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-3 text-sm font-medium text-gray-900 dark:text-white">
            {t('formSchemaNotAvailable')}
          </h3>
          <Link
            href={`/collecte/submissions/${id}/review`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Review
          </Link>
        </div>
      )}
    </div>
  );
}
