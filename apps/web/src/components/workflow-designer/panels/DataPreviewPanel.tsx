'use client';

import React, { useState } from 'react';
import { X, Loader2, ChevronRight, ChevronDown, Table2, FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataPreviewSchema, useDataPreviewRecent } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';

// ── Recursive JSON Tree viewer ──

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (data === null || data === undefined) {
    return <span className="text-gray-400 text-xs italic">null</span>;
  }

  if (typeof data === 'boolean') {
    return <span className="text-xs text-orange-600 dark:text-orange-400">{String(data)}</span>;
  }

  if (typeof data === 'number') {
    return <span className="text-xs text-green-600 dark:text-green-400">{String(data)}</span>;
  }

  if (typeof data !== 'object') {
    return <span className="text-xs text-gray-700 dark:text-gray-300 break-all">{String(data)}</span>;
  }

  const entries: [string | number, unknown][] = Array.isArray(data)
    ? data.map((v, i) => [i, v])
    : Object.entries(data);

  if (entries.length === 0) {
    return <span className="text-xs text-gray-400">{Array.isArray(data) ? '[]' : '{}'}</span>;
  }

  return (
    <div className={cn(depth > 0 && 'ml-3')}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="font-mono">
          {Array.isArray(data) ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </button>
      {expanded && (
        <div className="ml-2 border-l border-gray-200 dark:border-gray-700 pl-2">
          {entries.map(([key, value]) => (
            <div key={String(key)} className="flex items-start gap-1 py-0.5">
              <span className="text-xs font-mono text-blue-600 dark:text-blue-400 shrink-0 select-all">
                {key}:
              </span>
              <JsonTree data={value} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Type badge colors ──

function typeBadge(type: string) {
  const colors: Record<string, string> = {
    text: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    number: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    select: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    date: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    checkbox: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    textarea: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    reference: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  };
  return colors[type] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
}

// ── Status badge ──

function statusBadge(status: string) {
  const s = (status ?? '').toUpperCase();
  if (s === 'APPROVED' || s === 'COMPLETED') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (s === 'REJECTED') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (s === 'PENDING' || s === 'IN_PROGRESS') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
}

// ── Main Panel ──

interface DataPreviewPanelProps {
  definitionId: string;
  onClose: () => void;
}

export function DataPreviewPanel({ definitionId, onClose }: DataPreviewPanelProps) {
  const t = useTranslations('workflow');
  const [activeTab, setActiveTab] = useState<'schema' | 'recent'>('schema');

  const { data: schemaRes, isLoading: schemaLoading } = useDataPreviewSchema(definitionId);
  const { data: recentRes, isLoading: recentLoading } = useDataPreviewRecent(definitionId);

  const fields = schemaRes?.data?.fields ?? [];
  const templateCount = schemaRes?.data?.templateCount ?? 0;
  const recentData = recentRes?.data ?? [];

  return (
    <div className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <FileJson className="h-4 w-4 text-cyan-500" />
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
            {t('designer.dataPreview') || 'Data Preview'}
          </h3>
          {templateCount > 0 && (
            <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 font-mono">
              {templateCount} template{templateCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button
          onClick={() => setActiveTab('schema')}
          className={cn(
            'flex-1 px-4 py-2 text-xs font-semibold transition border-b-2',
            activeTab === 'schema'
              ? 'border-cyan-500 text-cyan-700 dark:text-cyan-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
          )}
        >
          <Table2 className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
          {t('designer.schema') || 'Schema'}
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={cn(
            'flex-1 px-4 py-2 text-xs font-semibold transition border-b-2',
            activeTab === 'recent'
              ? 'border-cyan-500 text-cyan-700 dark:text-cyan-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
          )}
        >
          <FileJson className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
          {t('designer.recentData') || 'Recent Data'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'schema' ? (
          <SchemaTab fields={fields} isLoading={schemaLoading} t={t} />
        ) : (
          <RecentDataTab data={recentData} isLoading={recentLoading} t={t} />
        )}
      </div>
    </div>
  );
}

// ── Schema Tab ──

function SchemaTab({
  fields,
  isLoading,
  t,
}: {
  fields: Array<{ key: string; label: string; type: string; templateName: string }>;
  isLoading: boolean;
  t: (key: string) => string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Table2 className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('designer.noSchemaFound') || 'No form templates linked to this workflow'}
        </p>
      </div>
    );
  }

  // Group fields by template
  const grouped = fields.reduce<Record<string, typeof fields>>((acc, f) => {
    const key = f.templateName || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {t('designer.dataFields') || 'Data Fields'} ({fields.length})
      </p>
      {Object.entries(grouped).map(([tmplName, tmplFields]) => (
        <div key={tmplName}>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            {tmplName}
          </p>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  <th className="px-3 py-1.5 text-left text-gray-500 font-medium">
                    {t('designer.fieldName') || 'Field'}
                  </th>
                  <th className="px-3 py-1.5 text-left text-gray-500 font-medium">
                    {t('designer.fieldType') || 'Type'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {tmplFields.map((f, i) => (
                  <tr key={`${f.key}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition">
                    <td className="px-3 py-1.5">
                      <div className="font-mono text-gray-700 dark:text-gray-300">{f.key}</div>
                      {f.label !== f.key && (
                        <div className="text-[10px] text-gray-400 mt-0.5">{f.label}</div>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold', typeBadge(f.type))}>
                        {f.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Recent Data Tab ──

function RecentDataTab({
  data,
  isLoading,
  t,
}: {
  data: any[];
  isLoading: boolean;
  t: (key: string) => string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileJson className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('designer.noRecentData') || 'No recent submissions found'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {t('designer.recentSubmissions') || 'Recent Submissions'} ({data.length})
      </p>
      {data.map((item: any, idx: number) => (
        <SubmissionCard key={item.id ?? idx} item={item} t={t} />
      ))}
    </div>
  );
}

// ── Submission Card ──

function SubmissionCard({ item, t }: { item: any; t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false);

  const submittedAt = item.submitted_at
    ? new Date(item.submitted_at).toLocaleString()
    : '—';

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {t('designer.submittedAt') || 'Submitted at'}: {submittedAt}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {item.status && (
            <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold', statusBadge(item.status))}>
              {item.status}
            </span>
          )}
          {item.workflow_status && item.workflow_status !== item.status && (
            <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold', statusBadge(item.workflow_status))}>
              {item.workflow_status}
            </span>
          )}
        </div>
      </button>
      {expanded && item.data && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 max-h-64 overflow-y-auto">
          <JsonTree data={item.data} />
        </div>
      )}
    </div>
  );
}
