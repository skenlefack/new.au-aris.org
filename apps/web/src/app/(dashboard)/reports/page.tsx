'use client';

import React, { useState } from 'react';
import {
  Plus,
  Shield,
  Calendar,
  Globe,
  BarChart3,
  CheckCircle,
  Flag,
  Download,
  FileText,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ReportType = 'WAHIS' | 'Continental' | 'Custom' | 'System';
type ReportStatus = 'generating' | 'completed' | 'failed';

interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  type: ReportType;
  icon: React.ElementType;
}

interface RecentReport {
  id: string;
  name: string;
  type: ReportType;
  generatedBy: string;
  date: string;
  status: ReportStatus;
}

/* ------------------------------------------------------------------ */
/*  Badge maps                                                         */
/* ------------------------------------------------------------------ */

const TYPE_BADGE: Record<ReportType, string> = {
  WAHIS: 'bg-blue-100 text-blue-700',
  Continental: 'bg-purple-100 text-purple-700',
  Custom: 'bg-green-100 text-green-700',
  System: 'bg-gray-100 text-gray-600',
};

const STATUS_BADGE: Record<ReportStatus, string> = {
  generating: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

/* ------------------------------------------------------------------ */
/*  Placeholder data                                                   */
/* ------------------------------------------------------------------ */

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'tpl-1',
    title: 'WAHIS Notification Report',
    description:
      'Generate immediate and follow-up notification reports for submission to WOAH via the WAHIS platform.',
    type: 'WAHIS',
    icon: Shield,
  },
  {
    id: 'tpl-2',
    title: 'Six-Monthly Report',
    description:
      'Compile the six-monthly situation report covering all listed diseases with national status and control measures.',
    type: 'WAHIS',
    icon: Calendar,
  },
  {
    id: 'tpl-3',
    title: 'Continental Brief',
    description:
      'AU-IBAR continental animal resources brief aggregating data across all 55 Member States and 8 RECs.',
    type: 'Continental',
    icon: Globe,
  },
  {
    id: 'tpl-4',
    title: 'Domain Performance Report',
    description:
      'Customizable performance report across any business domain with KPIs, trends, and benchmarks.',
    type: 'Custom',
    icon: BarChart3,
  },
  {
    id: 'tpl-5',
    title: 'Data Quality Report',
    description:
      'Automated data quality assessment with completeness, consistency, and confidence scoring across submissions.',
    type: 'System',
    icon: CheckCircle,
  },
  {
    id: 'tpl-6',
    title: 'Country Profile Report',
    description:
      'Comprehensive country-level profile covering animal health, production, trade, and governance indicators.',
    type: 'Custom',
    icon: Flag,
  },
];

const RECENT_REPORTS: RecentReport[] = [
  {
    id: 'rpt-1',
    name: 'WAHIS Notification — Kenya FMD Q1 2026',
    type: 'WAHIS',
    generatedBy: 'Dr. Ochieng',
    date: '2026-03-14T09:30:00Z',
    status: 'completed',
  },
  {
    id: 'rpt-2',
    name: 'Continental Brief — March 2026',
    type: 'Continental',
    generatedBy: 'AU-IBAR Secretariat',
    date: '2026-03-13T14:15:00Z',
    status: 'generating',
  },
  {
    id: 'rpt-3',
    name: 'Data Quality Assessment — IGAD Region',
    type: 'System',
    generatedBy: 'System',
    date: '2026-03-12T08:00:00Z',
    status: 'completed',
  },
  {
    id: 'rpt-4',
    name: 'Country Profile — Ethiopia 2025/2026',
    type: 'Custom',
    generatedBy: 'Dr. Bekele',
    date: '2026-03-11T16:45:00Z',
    status: 'completed',
  },
  {
    id: 'rpt-5',
    name: 'Six-Monthly Report — Nigeria H2 2025',
    type: 'WAHIS',
    generatedBy: 'Dr. Adamu',
    date: '2026-03-10T11:20:00Z',
    status: 'failed',
  },
];

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function ReportsPage() {
  const [recentReports] = useState<RecentReport[]>(RECENT_REPORTS);

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate, schedule and export official reports
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-aris-primary-700">
          <Plus className="h-4 w-4" />
          New Report
        </button>
      </div>

      {/* ---- Report Templates grid ---- */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Report Templates
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <div
                key={tpl.id}
                className="rounded-card border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Icon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {tpl.title}
                    </h3>
                    <span
                      className={cn(
                        'mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                        TYPE_BADGE[tpl.type],
                      )}
                    >
                      {tpl.type}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-gray-500 line-clamp-2">
                  {tpl.description}
                </p>

                <div className="mt-4 border-t border-gray-100 pt-3">
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-aris-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-aris-primary-700">
                    <FileText className="h-3.5 w-3.5" />
                    Generate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Recent Reports table ---- */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Recent Reports
        </h2>

        {recentReports.length === 0 ? (
          /* Empty state */
          <div className="rounded-card border border-gray-200 bg-white p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-sm font-medium text-gray-900">
              No reports generated yet
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Select a template above to generate your first report.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Report Name
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Generated By
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentReports.map((report) => (
                    <tr
                      key={report.id}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {report.name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                            TYPE_BADGE[report.type],
                          )}
                        >
                          {report.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {report.generatedBy}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(report.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            STATUS_BADGE[report.status],
                          )}
                        >
                          {report.status === 'generating' && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          {report.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          disabled={report.status !== 'completed'}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                            report.status === 'completed'
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'cursor-not-allowed bg-gray-50 text-gray-300',
                          )}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
