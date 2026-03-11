'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  FileText,
  Globe,
  Loader2,
} from 'lucide-react';
import {
  useCampaign,
  useUpdateCampaign,
  type CollecteCampaign,
} from '@/lib/api/hooks';

/* eslint-disable no-console */
import {
  useFormBuilderTemplates,
  type FormTemplateListItem,
} from '@/lib/api/form-builder-hooks';
import { COUNTRIES, type CountryConfig } from '@/data/countries-config';
import { DOMAIN_OPTIONS } from '@/components/form-builder/utils/field-types';
import { MultiSearchCombobox } from '@/components/ui/MultiSearchCombobox';
import { TableSkeleton } from '@/components/ui/Skeleton';

const countryList: CountryConfig[] = Object.values(COUNTRIES).sort((a, b) =>
  a.name.localeCompare(b.name),
);

// Fallback templates (same as new page)
const SEED_TEMPLATES: FormTemplateListItem[] = [
  // Animal Health (6) — deterministic UUIDs for fallback templates
  { id: 'a0000001-0001-4000-8000-000000000001', tenantId: '', name: 'AU-IBAR Monthly Animal Health Report', domain: 'animal_health', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'a0000001-0002-4000-8000-000000000002', tenantId: '', name: 'Emergency Disease Reporting', domain: 'animal_health', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'a0000001-0003-4000-8000-000000000003', tenantId: '', name: 'Mass Vaccination', domain: 'animal_health', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'a0000001-0004-4000-8000-000000000004', tenantId: '', name: 'Meat Inspection', domain: 'animal_health', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'a0000001-0005-4000-8000-000000000005', tenantId: '', name: 'Monthly Abattoir Report', domain: 'animal_health', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'a0000001-0006-4000-8000-000000000006', tenantId: '', name: 'Monthly Vaccination Report', domain: 'animal_health', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  // Livestock (7)
  { id: 'b0000002-0001-4000-8000-000000000007', tenantId: '', name: 'Animal Breeding and Genomics', domain: 'livestock', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'b0000002-0002-4000-8000-000000000008', tenantId: '', name: 'Animal Population (Genetic Diversity)', domain: 'livestock', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'b0000002-0003-4000-8000-000000000009', tenantId: '', name: 'Animal Population and Composition', domain: 'livestock', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'b0000002-0004-4000-8000-00000000000a', tenantId: '', name: 'Breeder Association', domain: 'livestock', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'b0000002-0005-4000-8000-00000000000b', tenantId: '', name: 'Disaster and Risk Management', domain: 'livestock', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'b0000002-0006-4000-8000-00000000000c', tenantId: '', name: 'Legislation', domain: 'livestock', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'b0000002-0007-4000-8000-00000000000d', tenantId: '', name: 'National Animal Genetic Resources Centre', domain: 'livestock', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  // Trade & SPS (8)
  { id: 'c0000003-0001-4000-8000-00000000000e', tenantId: '', name: 'Cost of Production', domain: 'trade_sps', version: 1, status: 'PUBLISHED', dataClassification: 'PARTNER', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'c0000003-0002-4000-8000-00000000000f', tenantId: '', name: 'Import and Export', domain: 'trade_sps', version: 1, status: 'PUBLISHED', dataClassification: 'PARTNER', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'c0000003-0003-4000-8000-000000000010', tenantId: '', name: 'Market Demand', domain: 'trade_sps', version: 1, status: 'PUBLISHED', dataClassification: 'PARTNER', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'c0000003-0004-4000-8000-000000000011', tenantId: '', name: 'Market Price', domain: 'trade_sps', version: 1, status: 'PUBLISHED', dataClassification: 'PARTNER', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'c0000003-0005-4000-8000-000000000012', tenantId: '', name: 'Market Requirement and Location', domain: 'trade_sps', version: 1, status: 'PUBLISHED', dataClassification: 'PARTNER', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'c0000003-0006-4000-8000-000000000013', tenantId: '', name: 'Quality Standards (Inputs & Services)', domain: 'trade_sps', version: 1, status: 'PUBLISHED', dataClassification: 'PARTNER', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'c0000003-0007-4000-8000-000000000014', tenantId: '', name: 'Quality Standards (Poultry/Hatchery)', domain: 'trade_sps', version: 1, status: 'PUBLISHED', dataClassification: 'PARTNER', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'c0000003-0008-4000-8000-000000000015', tenantId: '', name: 'Volume and Availability of Transport', domain: 'trade_sps', version: 1, status: 'PUBLISHED', dataClassification: 'PARTNER', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
];

function toDateInputValue(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

export default function EditCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const { data: campaignRes, isLoading: campaignLoading } = useCampaign(campaignId);
  const updateCampaign = useUpdateCampaign();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<FormTemplateListItem[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<CountryConfig[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetSubmissions, setTargetSubmissions] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: templatesData, isLoading: templatesLoading } = useFormBuilderTemplates({
    page: 1,
    limit: 100,
  });

  const allTemplates = useMemo(() => {
    const apiData = templatesData?.data ?? [];
    return apiData.length > 0 ? apiData : SEED_TEMPLATES;
  }, [templatesData]);

  const publishedTemplates = useMemo(() => {
    return allTemplates.filter((t) => t.status === 'PUBLISHED');
  }, [allTemplates]);

  // Initialize form from campaign data once loaded
  const campaign = (campaignRes as any)?.data as CollecteCampaign | undefined;

  useEffect(() => {
    if (campaign && !initialized) {
      setName(campaign.name ?? '');
      setDescription(campaign.description ?? '');
      setDomain(campaign.domain ?? '');
      setStartDate(toDateInputValue(campaign.startDate));
      setEndDate(toDateInputValue(campaign.endDate));
      setTargetSubmissions(campaign.targetSubmissions != null ? String(campaign.targetSubmissions) : '');

      // Restore selected templates
      const tplIds = campaign.templateIds ?? (campaign.templateId ? [campaign.templateId] : []);
      const matchedTemplates = allTemplates.filter((t) => tplIds.includes(t.id));
      if (matchedTemplates.length > 0) {
        setSelectedTemplates(matchedTemplates);
      }

      // Restore selected countries
      const countryCodes = campaign.targetCountries ?? [];
      const matchedCountries = countryCodes
        .map((code) => COUNTRIES[code.toUpperCase()])
        .filter(Boolean) as CountryConfig[];
      if (matchedCountries.length > 0) {
        setSelectedCountries(matchedCountries);
      }

      setInitialized(true);
    }
  }, [campaign, initialized, allTemplates]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Campaign name is required';
    if (!startDate) e.startDate = 'Start date is required';
    if (!endDate) e.endDate = 'End date is required';
    if (startDate && endDate && startDate > endDate) e.endDate = 'End date must be after start date';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;

    setSubmitError(null);
    const payload = {
      id: campaignId,
      name: name.trim(),
      description: description.trim(),
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      targetSubmissions: targetSubmissions ? parseInt(targetSubmissions, 10) : undefined,
      templateIds: selectedTemplates.map((t) => t.id),
      targetCountries: selectedCountries.map((c) => c.code),
    };
    console.log('[EditCampaign] Submitting PATCH:', JSON.stringify(payload, null, 2));

    try {
      const result = await updateCampaign.mutateAsync(payload);
      console.log('[EditCampaign] PATCH success:', result);
      router.push('/collecte');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[EditCampaign] PATCH failed:', err);
      setSubmitError(msg);
    }
  }

  if (campaignLoading) {
    return (
      <div className="space-y-6 pb-12">
        <div>
          <Link
            href="/collecte"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Edit Campaign</h1>
        </div>
        <TableSkeleton rows={6} cols={2} />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-6 pb-12">
        <div>
          <Link
            href="/collecte"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Campaign not found</h1>
        </div>
      </div>
    );
  }

  if (campaign.status !== 'PLANNED') {
    return (
      <div className="space-y-6 pb-12">
        <div>
          <Link
            href="/collecte"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Cannot Edit</h1>
          <p className="mt-1 text-sm text-gray-500">
            Only campaigns with status &quot;Planned&quot; can be edited. This campaign is{' '}
            <strong>{campaign.status}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <Link
          href="/collecte"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          Edit Campaign
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Editing &ldquo;{campaign.name}&rdquo;
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ROW 1 — Two columns */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Campaign Information */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-gray-400" />
              Campaign Information
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Campaign Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Domain
              </label>
              <select
                value={domain}
                disabled
                className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
              >
                <option value="">—</option>
                {DOMAIN_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Domain cannot be changed after creation.
              </p>
            </div>
          </div>

          {/* Scheduling */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              Scheduling
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Target Submissions
              </label>
              <input
                type="number"
                min="0"
                value={targetSubmissions}
                onChange={(e) => setTargetSubmissions(e.target.value)}
                placeholder="e.g. 500"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* ROW 2 — Form Templates */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            Form Templates
          </h2>
          <MultiSearchCombobox<FormTemplateListItem>
            value={selectedTemplates}
            onChange={setSelectedTemplates}
            items={publishedTemplates}
            labelKey={(t) => t.name}
            idKey={(t) => t.id}
            filterKey={(t) => `${t.name} ${t.domain}`}
            placeholder="Search form templates..."
            allLabel="All Templates"
            loading={templatesLoading}
            renderItem={(t) => (
              <span className="flex items-center gap-2">
                <span>{t.name}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  {DOMAIN_OPTIONS.find((d) => d.value === t.domain)?.label ?? t.domain}
                </span>
              </span>
            )}
            renderChip={(t) => (
              <span className="flex items-center gap-1">
                {t.name}
                <span className="rounded bg-aris-primary-100 px-1 text-[9px] text-aris-primary-600 dark:bg-aris-primary-800/50 dark:text-aris-primary-300">
                  {DOMAIN_OPTIONS.find((d) => d.value === t.domain)?.label ?? t.domain}
                </span>
              </span>
            )}
          />
          {selectedTemplates.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {selectedTemplates.length} template{selectedTemplates.length > 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* ROW 3 — Target Countries */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-400" />
            Target Countries
          </h2>
          <MultiSearchCombobox<CountryConfig>
            value={selectedCountries}
            onChange={setSelectedCountries}
            items={countryList}
            labelKey={(c) => `${c.flag} ${c.name}`}
            idKey={(c) => c.code}
            filterKey={(c) => `${c.name} ${c.code} ${c.nameFr}`}
            placeholder="Search countries..."
            allLabel="All Countries"
            renderItem={(c) => (
              <span className="flex items-center gap-2">
                <span>{c.flag}</span>
                <span>{c.name}</span>
                <span className="text-gray-400">{c.code}</span>
              </span>
            )}
            renderChip={(c) => (
              <span className="flex items-center gap-1">
                {c.flag} {c.name}
              </span>
            )}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/collecte"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={updateCampaign.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
          >
            {updateCampaign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </div>

        {(updateCampaign.isError || submitError) && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-400">
              {submitError ?? 'Failed to update campaign. Please try again.'}
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
