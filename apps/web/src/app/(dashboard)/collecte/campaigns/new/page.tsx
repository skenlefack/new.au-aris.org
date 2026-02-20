'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import {
  useCreateCampaign,
  useFormTemplates,
  type CreateCampaignRequest,
} from '@/lib/api/hooks';

const AVAILABLE_ZONES = [
  'Rift Valley',
  'Central',
  'Western',
  'Eastern',
  'Coastal',
  'North Eastern',
  'Nairobi',
  'Nyanza',
];

export default function NewCampaignPage() {
  const router = useRouter();
  const { data: templatesData } = useFormTemplates();
  const createCampaign = useCreateCampaign();

  const templates = templatesData?.data ?? [];

  const [form, setForm] = useState<CreateCampaignRequest>({
    name: '',
    description: '',
    templateId: '',
    startDate: '',
    endDate: '',
    zones: [],
    agentIds: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Campaign name is required';
    if (!form.templateId) newErrors.templateId = 'Select a form template';
    if (!form.startDate) newErrors.startDate = 'Start date is required';
    if (!form.endDate) newErrors.endDate = 'End date is required';
    if (form.startDate && form.endDate && form.startDate > form.endDate)
      newErrors.endDate = 'End date must be after start date';
    if (form.zones.length === 0) newErrors.zones = 'Select at least one zone';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function toggleZone(zone: string) {
    setForm((prev) => ({
      ...prev,
      zones: prev.zones.includes(zone)
        ? prev.zones.filter((z) => z !== zone)
        : [...prev.zones, zone],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      await createCampaign.mutateAsync(form);
      router.push('/collecte');
    } catch {
      // Error handled by React Query
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/collecte"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Create Campaign
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Set up a new data collection campaign
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Campaign info */}
        <div className="rounded-card border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gray-400" />
            Campaign Information
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Campaign Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. FMD Surveillance Q1 2026"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              placeholder="Describe the campaign objectives..."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Form Template *
            </label>
            <select
              value={form.templateId}
              onChange={(e) =>
                setForm({ ...form, templateId: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
            >
              <option value="">Select a template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.domain}, v{t.version})
                </option>
              ))}
            </select>
            {errors.templateId && (
              <p className="mt-1 text-xs text-red-600">{errors.templateId}</p>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="rounded-card border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            Schedule
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Start Date *
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
              />
              {errors.startDate && (
                <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                End Date *
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm({ ...form, endDate: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
              />
              {errors.endDate && (
                <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>
              )}
            </div>
          </div>
        </div>

        {/* Zones */}
        <div className="rounded-card border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            Target Zones *
          </h2>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_ZONES.map((zone) => (
              <button
                key={zone}
                type="button"
                onClick={() => toggleZone(zone)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  form.zones.includes(zone)
                    ? 'border-aris-primary-500 bg-aris-primary-50 text-aris-primary-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                {zone}
              </button>
            ))}
          </div>
          {errors.zones && (
            <p className="text-xs text-red-600">{errors.zones}</p>
          )}
        </div>

        {/* Agents (placeholder) */}
        <div className="rounded-card border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            Field Agents
          </h2>
          <p className="text-xs text-gray-500">
            Agents will be assigned based on selected zones. You can modify
            assignments after campaign creation.
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/collecte"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createCampaign.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
          >
            {createCampaign.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
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
