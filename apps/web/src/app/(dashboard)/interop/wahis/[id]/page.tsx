'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, FileText, Copy, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWahisExport } from '@/lib/api/hooks';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  draft: { icon: <FileText className="h-4 w-4" />, color: 'text-gray-600', bg: 'bg-gray-100' },
  pending: { icon: <Clock className="h-4 w-4" />, color: 'text-amber-600', bg: 'bg-amber-100' },
  exported: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-blue-600', bg: 'bg-blue-100' },
  accepted: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-600', bg: 'bg-green-100' },
  rejected: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-600', bg: 'bg-red-100' },
};

export default function WahisExportDetailPage() {
  const t = useTranslations('interop');
  const params = useParams();
  const id = params.id as string;
  const { data, isLoading } = useWahisExport(id);
  const exp = data?.data;

  if (isLoading) return <DetailSkeleton />;
  if (!exp) {
    return (
      <div className="text-center py-12 text-gray-400">{t('exportNotFound')}</div>
    );
  }

  const config = STATUS_CONFIG[exp.status] ?? STATUS_CONFIG['draft'];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/interop/wahis"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToWahisExports')}
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {exp.country} — {exp.reportType}
            </h1>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium capitalize',
                config.bg,
                config.color,
              )}
            >
              {config.icon}
              {exp.status}
            </span>
          </div>
          {exp.downloadUrl && (
            <a
              href={exp.downloadUrl}
              className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700"
              download
            >
              <Download className="h-4 w-4" />
              {t('download')} {exp.format}
            </a>
          )}
        </div>
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-gray-500">Country</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {exp.country} ({exp.countryCode})
          </p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-gray-500">{t('period')}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{exp.period}</p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-gray-500">Records</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {exp.recordCount}
          </p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-gray-500">{t('wahisRef')}</p>
          <p className="mt-1 text-sm font-mono text-gray-900">
            {exp.wahisRef ?? '—'}
          </p>
        </div>
      </div>

      {/* Records table */}
      {exp.records && exp.records.length > 0 && (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {t('includedRecords', { count: exp.records.length })}
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">{t('disease')}</th>
                <th className="px-4 py-3">{t('species')}</th>
                <th className="px-4 py-3">{t('region')}</th>
                <th className="px-4 py-3 text-right">{t('cases')}</th>
                <th className="px-4 py-3 text-right">{t('deaths')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exp.records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.disease}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.species}</td>
                  <td className="px-4 py-3 text-gray-600">{r.region}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {r.cases}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-red-600">
                    {r.deaths}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Format Preview */}
      {exp.formatPreview && (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {t('formatPreview', { format: exp.format })}
            </h3>
            <button
              onClick={() =>
                navigator.clipboard.writeText(exp.formatPreview)
              }
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Copy className="h-3.5 w-3.5" />
              {t('copy')}
            </button>
          </div>
          <pre className="max-h-80 overflow-auto bg-gray-900 p-4 text-xs text-green-400">
            {exp.formatPreview}
          </pre>
        </div>
      )}
    </div>
  );
}
