'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  FileText,
  Globe,
  Loader2,
  Settings,
} from 'lucide-react';
import {
  useCreateCampaign,
  type CreateCampaignRequest,
} from '@/lib/api/hooks';
import {
  useFormBuilderTemplates,
  type FormTemplateListItem,
} from '@/lib/api/form-builder-hooks';
import { COUNTRIES, type CountryConfig } from '@/data/countries-config';
import { DOMAIN_OPTIONS } from '@/components/form-builder/utils/field-types';
import { MultiSearchCombobox } from '@/components/ui/MultiSearchCombobox';

const FREQUENCY_OPTIONS = [
  { value: 'one_time', label: 'One-time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const countryList: CountryConfig[] = Object.values(COUNTRIES).sort((a, b) =>
  a.name.localeCompare(b.name),
);

// ─── Fallback templates when form-builder service is offline ──────────────
// Matches exactly the 21 seeded templates from services/form-builder/src/seed.ts
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

export default function NewCampaignPage() {
  const router = useRouter();
  const createCampaign = useCreateCampaign();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<FormTemplateListItem[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<CountryConfig[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetSubmissions, setTargetSubmissions] = useState<string>('');
  const [frequency, setFrequency] = useState('one_time');
  const [sendReminders, setSendReminders] = useState(false);
  const [reminderDays, setReminderDays] = useState('3');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch all templates (no server-side status/domain filter — filter client-side)
  const { data: templatesData, isLoading: templatesLoading } = useFormBuilderTemplates({
    page: 1,
    limit: 100,
  });

  // Show only PUBLISHED templates, filtered by domain when selected
  // Falls back to SEED_TEMPLATES when form-builder service is offline
  const publishedTemplates = useMemo(() => {
    const apiData = templatesData?.data ?? [];
    const all = apiData.length > 0 ? apiData : SEED_TEMPLATES;
    return all.filter((t) => {
      if (t.status !== 'PUBLISHED') return false;
      if (domain && t.domain !== domain) return false;
      return true;
    });
  }, [templatesData, domain]);

  // When domain changes, clear templates that no longer match
  const handleDomainChange = (newDomain: string) => {
    setDomain(newDomain);
    if (newDomain) {
      setSelectedTemplates((prev) => prev.filter((t) => t.domain === newDomain));
    }
  };

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Campaign name is required';
    if (!domain) e.domain = 'Domain is required';
    if (selectedTemplates.length === 0) e.templates = 'Select at least one form template';
    if (selectedCountries.length === 0) e.countries = 'Select at least one country';
    if (!startDate) e.startDate = 'Start date is required';
    if (!endDate) e.endDate = 'End date is required';
    if (startDate && endDate && startDate > endDate) e.endDate = 'End date must be after start date';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;

    const payload: CreateCampaignRequest = {
      name: name.trim(),
      domain,
      templateId: selectedTemplates[0]?.id ?? '',
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      targetZones: [],
      assignedAgents: [],
      description: description.trim() || undefined,
      targetSubmissions: targetSubmissions ? parseInt(targetSubmissions, 10) : undefined,
      // Extended fields
      templateIds: selectedTemplates.map((t) => t.id),
      targetCountries: selectedCountries.map((c) => c.code),
      frequency,
      sendReminders,
      reminderDaysBefore: sendReminders ? parseInt(reminderDays, 10) : undefined,
    };

    try {
      await createCampaign.mutateAsync(payload);
      router.push('/collecte');
    } catch {
      // Error handled by React Query
    }
  }

  const domainLabel = domain
    ? DOMAIN_OPTIONS.find((d) => d.value === domain)?.label ?? domain
    : null;

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
          Create Campaign
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Set up a new data collection campaign across countries and forms
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ROW 1 — Two-column: Information (left) + Scheduling & Options (right) */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* LEFT — Campaign Information */}
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
                placeholder="e.g. FMD Surveillance Q1 2026"
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
                placeholder="Describe the campaign objectives..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Domain <span className="text-red-500">*</span>
              </label>
              <select
                value={domain}
                onChange={(e) => handleDomainChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select a domain...</option>
                {DOMAIN_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              {errors.domain && <p className="mt-1 text-xs text-red-600">{errors.domain}</p>}
            </div>
          </div>

          {/* RIGHT — Scheduling + Options */}
          <div className="space-y-6">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    {FREQUENCY_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="h-4 w-4 text-gray-400" />
                Options
              </h2>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Send Reminders
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notify agents before the campaign deadline
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sendReminders}
                  onClick={() => setSendReminders(!sendReminders)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    sendReminders ? 'bg-aris-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      sendReminders ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {sendReminders && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Reminder Days Before Deadline
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={reminderDays}
                    onChange={(e) => setReminderDays(e.target.value)}
                    className="mt-1 w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2 — Full width: Form Templates */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            Form Templates <span className="text-red-500">*</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {domainLabel
              ? `Showing published templates for "${domainLabel}". Change domain to see others.`
              : 'Select a domain to filter, or browse all published templates.'}
          </p>
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
                <span className="text-[10px] text-gray-400">v{t.version}</span>
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
          {errors.templates && <p className="text-xs text-red-600">{errors.templates}</p>}

          {/* Selected templates detail list */}
          {selectedTemplates.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {selectedTemplates.length} template{selectedTemplates.length > 1 ? 's' : ''} selected
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {selectedTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {t.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {DOMAIN_OPTIONS.find((d) => d.value === t.domain)?.label ?? t.domain} &middot; v{t.version}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Published
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ROW 3 — Full width: Target Countries */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-400" />
            Target Countries <span className="text-red-500">*</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Select the AU Member States targeted by this campaign.
          </p>
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
          {errors.countries && <p className="text-xs text-red-600">{errors.countries}</p>}
        </div>

        {/* Footer — full width */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/collecte"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createCampaign.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
          >
            {createCampaign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Campaign
          </button>
        </div>

        {createCampaign.isError && (
          <p className="text-sm text-red-600">
            Failed to create campaign. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}
