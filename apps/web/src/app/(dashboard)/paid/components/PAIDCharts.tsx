'use client';

import React from 'react';
import { SECTOR_COLORS } from '@/lib/paid';
import type { PaidAggregates, PaidSectorAgg, PaidCountryAgg } from '@/lib/paid';

/* ------------------------------------------------------------------ */
/*  Pie chart — % Projects by Sector                                   */
/* ------------------------------------------------------------------ */

interface PieSectionProps {
  agg: PaidAggregates;
  t: (key: string) => string;
}

export function PAIDProjectsPie({ agg, t }: PieSectionProps) {
  const entries = Array.from(agg.bySector.values())
    .sort((a, b) => b.projects.size - a.projects.size);
  const total = entries.reduce((s, e) => s + e.projects.size, 0) || 1;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{t('projectsByCategory')}</h4>
      <div className="space-y-2">
        {entries.slice(0, 8).map((e) => {
          const pct = Math.round((e.projects.size / total) * 100);
          const color = SECTOR_COLORS[e.sector] ?? '#9E9E9E';
          return (
            <div key={e.sector}>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-gray-700 dark:text-gray-300">{e.sector}</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">{pct}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[10px] text-gray-400">{total} {t('totalProjects').toLowerCase()}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Horizontal bar — Beneficiaries by Country (top 15)                 */
/* ------------------------------------------------------------------ */

interface BarProps {
  agg: PaidAggregates;
  t: (key: string) => string;
}

export function PAIDBenefByCountry({ agg, t }: BarProps) {
  const entries = Array.from(agg.byCountry.values())
    .sort((a, b) => b.beneficiaries - a.beneficiaries)
    .slice(0, 15);
  const max = entries[0]?.beneficiaries || 1;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{t('benefByCountry')}</h4>
      <div className="space-y-2">
        {entries.map((e) => {
          const pct = Math.round((e.beneficiaries / max) * 100);
          return (
            <div key={e.country} className="flex items-center gap-2">
              <span className="w-20 shrink-0 truncate text-right text-[11px] font-medium text-gray-600 dark:text-gray-400">{e.country}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-700">
                <div className="h-full rounded bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-[10px] font-semibold text-gray-900 dark:text-white">
                {e.beneficiaries >= 1_000_000 ? `${(e.beneficiaries / 1_000_000).toFixed(1)}M` : e.beneficiaries.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pie-style — Beneficiaries by Activity Type (top 8)                 */
/* ------------------------------------------------------------------ */

const ACTIVITY_COLORS = ['#1565C0', '#2E7D32', '#E65100', '#6A1B9A', '#00838F', '#C62828', '#4E342E', '#37474F'];

export function PAIDBenefByActivity({ agg, t }: BarProps) {
  const entries = Array.from(agg.byActivity.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{t('benefByActivity')}</h4>
      <div className="space-y-2">
        {entries.map(([activity, count], idx) => {
          const pct = Math.round((count / total) * 100);
          const color = ACTIVITY_COLORS[idx % ACTIVITY_COLORS.length];
          return (
            <div key={activity}>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="truncate text-gray-700 dark:text-gray-300" title={activity}>{activity.length > 40 ? `${activity.slice(0, 40)}...` : activity}</span>
                </div>
                <span className="shrink-0 font-semibold text-gray-900 dark:text-white">{pct}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Top Activities bar — horizontal                                    */
/* ------------------------------------------------------------------ */

export function PAIDActivitiesBar({ agg, t }: BarProps) {
  const entries = Array.from(agg.byActivity.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  const max = entries[0]?.[1] || 1;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{t('activitiesIncluded')}</h4>
      <div className="space-y-2">
        {entries.map(([activity, count], idx) => {
          const pct = Math.round((count / max) * 100);
          const color = ACTIVITY_COLORS[idx % ACTIVITY_COLORS.length];
          return (
            <div key={activity} className="flex items-center gap-2">
              <span className="w-48 shrink-0 truncate text-right text-[10px] font-medium text-gray-600 dark:text-gray-400" title={activity}>{activity}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-700">
                <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              <span className="w-14 shrink-0 text-right text-[10px] font-semibold text-gray-900 dark:text-white">{count.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sector breakdown — stacked summary row                             */
/* ------------------------------------------------------------------ */

interface SectorSummaryProps {
  agg: PaidAggregates;
  t: (key: string) => string;
}

export function PAIDSectorSummary({ agg, t }: SectorSummaryProps) {
  const entries = Array.from(agg.bySector.values())
    .sort((a, b) => b.beneficiaries - a.beneficiaries);

  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{t('bySector')}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="pb-2 text-left font-semibold text-gray-500">{t('filterSector')}</th>
              <th className="pb-2 text-right font-semibold text-gray-500">{t('beneficiariesReached')}</th>
              <th className="pb-2 text-right font-semibold text-gray-500">{t('individualsTrained')}</th>
              <th className="pb-2 text-right font-semibold text-gray-500">{t('totalProjects')}</th>
              <th className="pb-2 text-right font-semibold text-gray-500">{t('submissions')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const color = SECTOR_COLORS[e.sector] ?? '#9E9E9E';
              return (
                <tr key={e.sector} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-medium text-gray-700 dark:text-gray-300">{e.sector}</span>
                    </div>
                  </td>
                  <td className="py-2 text-right font-semibold text-gray-900 dark:text-white">{e.beneficiaries.toLocaleString()}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-gray-400">{e.trained.toLocaleString()}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-gray-400">{e.projects.size}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-gray-400">{e.submissions}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
