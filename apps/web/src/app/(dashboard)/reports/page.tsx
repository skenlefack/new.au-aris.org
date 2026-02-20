'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileText,
  Clock,
  FileBarChart,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReportTemplates } from '@/lib/api/hooks';
import { KpiCardSkeleton } from '@/components/ui/Skeleton';

const TYPE_BADGE_COLORS: Record<string, string> = {
  wahis_6monthly: 'bg-blue-100 text-blue-700',
  wahis_annual: 'bg-indigo-100 text-indigo-700',
  continental_brief: 'bg-green-100 text-green-700',
  custom: 'bg-purple-100 text-purple-700',
};

const TYPE_LABELS: Record<string, string> = {
  wahis_6monthly: 'WAHIS 6-Monthly',
  wahis_annual: 'WAHIS Annual',
  continental_brief: 'Continental Brief',
  custom: 'Custom',
};

const FORMAT_LABELS: Record<string, string> = {
  pdf: 'PDF',
  xlsx: 'Excel',
  docx: 'Word',
};

export default function ReportTemplatesPage() {
  const { data, isLoading } = useReportTemplates();

  const templates = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate and manage reports across ARIS domains
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/reports/history"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Clock className="h-4 w-4" />
            View History
          </Link>
          <Link
            href="/reports/generate"
            className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            New Report
          </Link>
        </div>
      </div>

      {/* Template grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-card border border-gray-200 bg-white p-12 text-center">
          <FileBarChart className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-900">
            No report templates available
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Report templates will appear here once configured by an administrator.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-card border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <FileText className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {template.name}
                    </h3>
                    <span
                      className={cn(
                        'mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                        TYPE_BADGE_COLORS[template.type] ?? 'bg-gray-100 text-gray-600',
                      )}
                    >
                      {TYPE_LABELS[template.type] ?? template.type}
                    </span>
                  </div>
                </div>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {FORMAT_LABELS[template.outputFormat] ?? template.outputFormat.toUpperCase()}
                </span>
              </div>

              <p className="mt-3 text-sm text-gray-500 line-clamp-2">
                {template.description}
              </p>

              {/* Domains tags */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {template.domains.map((domain) => (
                  <span
                    key={domain}
                    className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600"
                  >
                    {domain}
                  </span>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                <div className="text-xs text-gray-400">
                  {template.lastGeneratedAt ? (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last generated{' '}
                      {new Date(template.lastGeneratedAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <span>Never generated</span>
                  )}
                </div>
                <Link
                  href={`/reports/generate?template=${template.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-aris-primary-700"
                >
                  <FileBarChart className="h-3.5 w-3.5" />
                  Generate
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
