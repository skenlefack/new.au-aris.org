'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3, Plus, Calendar, DollarSign, Activity,
  ChevronRight, Briefcase,
} from 'lucide-react';
import { useProgrammes } from '@/lib/api/programme-monitoring-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';

function localName(name: Record<string, string> | string | undefined, locale: string): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  return name[locale] || name.en || '';
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

const STATUS_COLORS: Record<string, string> = {
  DESIGN: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-green-50 text-green-700',
  SUSPENDED: 'bg-amber-50 text-amber-700',
  CLOSED: 'bg-red-50 text-red-600',
};

export default function ProgrammeMonitoringPage() {
  const locale = useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { data: res, isLoading } = useProgrammes();

  const programmes = res?.data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-green-600" />
            Programme Monitoring
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            M&E, Activity Tracking, Budget Execution & Reporting
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition">
          <Plus className="h-4 w-4" />
          New Programme
        </button>
      </div>

      {/* Programme Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      ) : programmes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center">
          <Briefcase className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700">No programmes yet</h3>
          <p className="text-sm text-gray-500 mt-1">Create your first programme to start tracking activities and budgets</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {programmes.map((prog: any) => {
            const componentCount = prog.components?.length ?? 0;
            const activityCount = prog.components?.reduce(
              (s: number, c: any) => s + (c.outputs?.reduce((so: number, o: any) => so + (o.activities?.length ?? 0), 0) ?? 0),
              0,
            ) ?? 0;

            return (
              <div
                key={prog.id}
                onClick={() => router.push(`/programme-monitoring/${prog.id}`)}
                className="group rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition cursor-pointer dark:bg-gray-900 dark:border-gray-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                        {prog.code}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[prog.status] || STATUS_COLORS.DESIGN}`}>
                        {prog.status}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white group-hover:text-green-600 transition">
                      {localName(prog.name, locale)}
                    </h3>
                    {prog.donorName && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Funded by: {prog.donorName}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-green-500 transition" />
                </div>

                <div className="mt-4 grid grid-cols-4 gap-3 border-t pt-3 dark:border-gray-800">
                  <div className="text-center">
                    <DollarSign className="h-4 w-4 mx-auto text-gray-400 mb-1" />
                    <p className="text-xs font-bold">{fmt(Number(prog.totalBudget))}</p>
                    <p className="text-[10px] text-gray-400">{prog.currency}</p>
                  </div>
                  <div className="text-center">
                    <BarChart3 className="h-4 w-4 mx-auto text-gray-400 mb-1" />
                    <p className="text-xs font-bold">{componentCount}</p>
                    <p className="text-[10px] text-gray-400">Components</p>
                  </div>
                  <div className="text-center">
                    <Activity className="h-4 w-4 mx-auto text-gray-400 mb-1" />
                    <p className="text-xs font-bold">{activityCount}</p>
                    <p className="text-[10px] text-gray-400">Activities</p>
                  </div>
                  <div className="text-center">
                    <Calendar className="h-4 w-4 mx-auto text-gray-400 mb-1" />
                    <p className="text-xs font-bold">
                      {new Date(prog.startDate).getFullYear()}–{new Date(prog.endDate).getFullYear()}
                    </p>
                    <p className="text-[10px] text-gray-400">Period</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
