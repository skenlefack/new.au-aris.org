'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertCircle, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useSubmitCampaignForm } from '@/lib/api/hooks';
import { useCollectionCampaign } from '@/lib/api/workflow-hooks';
import {
  useFormBuilderTemplate,
  useFormBuilderTemplates,
  type FormTemplateListItem,
} from '@/lib/api/form-builder-hooks';
import { FormRenderer } from '@/components/form-builder/renderer/FormRenderer';
import { TableSkeleton } from '@/components/ui/Skeleton';
import type { FormSchema } from '@/components/form-builder/utils/form-schema';

// Hardcoded seed IDs used in campaign creation → real template name mapping
const SEED_TEMPLATE_NAMES: Record<string, string> = {
  'a0000001-0001-4000-8000-000000000001': 'AU-IBAR Monthly Animal Health Report',
  'a0000001-0002-4000-8000-000000000002': 'Emergency Disease Reporting',
  'a0000001-0003-4000-8000-000000000003': 'Mass Vaccination',
  'a0000001-0004-4000-8000-000000000004': 'Meat Inspection',
  'a0000001-0005-4000-8000-000000000005': 'Monthly Abattoir Report',
  'a0000001-0006-4000-8000-000000000006': 'Monthly Vaccination Report',
  'b0000002-0001-4000-8000-000000000007': 'Animal Breeding and Genomics',
  'b0000002-0002-4000-8000-000000000008': 'Animal Population (Genetic Diversity)',
  'b0000002-0003-4000-8000-000000000009': 'Animal Population and Composition',
  'c0000003-0001-4000-8000-00000000000e': 'Cost of Production',
  'c0000003-0002-4000-8000-00000000000f': 'Import and Export',
};

function extractSchema(tpl: FormTemplateListItem | undefined): FormSchema | null {
  if (!tpl?.schema) return null;
  if (typeof tpl.schema === 'object' && 'sections' in (tpl.schema as object)) {
    return tpl.schema as FormSchema;
  }
  return null;
}

export default function CampaignSubmitPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('collecte');
  const campaignId = params.id as string;
  const templateId = params.templateId as string;
  const isPreview = searchParams.get('preview') === '1';

  const { data: campaignRes, isLoading: campaignLoading } = useCollectionCampaign(campaignId);
  const submitMutation = useSubmitCampaignForm();

  // Try direct lookup by ID first (works when campaign uses real DB IDs)
  const { data: directRes, isFetching: directFetching } = useFormBuilderTemplate(templateId);

  // Also load all templates to match by name (fallback for hardcoded seed IDs)
  const seedName = SEED_TEMPLATE_NAMES[templateId];
  const { data: allTemplatesRes, isFetching: allFetching } = useFormBuilderTemplates({
    page: 1,
    limit: 100,
  });

  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const rawCampaign = (campaignRes as any)?.data as any | undefined;
  const campaign = rawCampaign ? {
    name: (() => {
      const n = rawCampaign.name;
      if (!n) return '';
      if (typeof n === 'string') return n;
      if (typeof n === 'object') return n.en ?? n.fr ?? Object.values(n)[0] ?? '';
      return String(n);
    })(),
    status: rawCampaign.status as string,
    targetCountries: (rawCampaign.targetCountries || []) as string[],
  } : undefined;

  // Resolve the template: direct ID match → name-based fallback
  const resolvedTemplate = useMemo((): FormTemplateListItem | undefined => {
    // 1. Direct lookup succeeded
    const direct = (directRes as any)?.data as FormTemplateListItem | undefined;
    if (direct?.schema) return direct;

    // 2. Fallback: find by name among all templates
    const all = allTemplatesRes?.data ?? [];
    if (seedName && all.length > 0) {
      return all.find((t) => t.name === seedName);
    }

    // 3. Still try direct even without schema (for name display)
    return direct;
  }, [directRes, allTemplatesRes, seedName]);

  const templateName = resolvedTemplate?.name ?? seedName ?? templateId.slice(0, 8) + '...';
  const schema = extractSchema(resolvedTemplate);

  // Show loading until we either resolved a template or both fetches settled
  const templateResolved = !!resolvedTemplate || (!directFetching && !allFetching);
  const isLoading = campaignLoading || !templateResolved;

  const handleSubmit = async (formData: Record<string, unknown>) => {
    setBanner(null);
    try {
      await submitMutation.mutateAsync({ campaignId, data: formData });
      setBanner({ type: 'success', message: t('submissionCreated') });
      setTimeout(() => {
        router.push(`/collecte/campaigns/${campaignId}`);
      }, 1200);
    } catch (err: any) {
      const msg = err?.message || t('submissionFailedRetry');
      setBanner({ type: 'error', message: msg });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-12">
        <div>
          <Link
            href={`/collecte/campaigns/${campaignId}`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToCampaign')}
          </Link>
          <div className="mt-2 h-8 w-64 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>
        <TableSkeleton rows={6} cols={3} />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-4 pb-12">
        <Link
          href="/collecte"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToCampaigns')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('campaignNotFound')}</h1>
      </div>
    );
  }

  // Allow ACTIVE for submission, PLANNED for preview only
  const allowAccess = campaign.status === 'ACTIVE' || (campaign.status === 'PLANNED' && isPreview);
  if (!allowAccess) {
    return (
      <div className="space-y-4 pb-12">
        <Link
          href={`/collecte/campaigns/${campaignId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToCampaign')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('campaignNotActive')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('campaignNotActiveDesc').replace('{status}', campaign.status)}
        </p>
      </div>
    );
  }

  // Force preview mode for PLANNED campaigns (cannot submit data)
  const previewMode = isPreview || campaign.status === 'PLANNED';

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <Link
          href={`/collecte/campaigns/${campaignId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToCampaign')}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
              {templateName}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('campaignLabel').replace('{name}', campaign.name)}
            </p>
          </div>
          {previewMode ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
              <Eye className="h-3.5 w-3.5" />
              {t('preview')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('active')}
            </span>
          )}
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
          preview={previewMode}
          onSubmit={previewMode ? undefined : handleSubmit}
          campaignTargetCountries={campaign?.targetCountries}
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <AlertCircle className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-3 text-sm font-medium text-gray-900 dark:text-white">
            {t('formSchemaNotAvailable')}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('formSchemaNotAvailableDesc').replace('{name}', templateName)}
          </p>
          <Link
            href={`/collecte/campaigns/${campaignId}`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('returnToCampaign')}
          </Link>
        </div>
      )}
    </div>
  );
}
