'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  Eye,
  Download,
  Send,
  Pencil,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  Database,
  Edit3,
  Save,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useReportV2,
  useReportStatus,
  useEditReportSection,
  useRegenerateSection,
  useApproveReport,
  usePublishReport,
  type ReportStatus,
  type SectionStatus,
  type SectionType,
  type ReportSection,
} from '@/lib/api/report-hooks';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_BADGE: Record<ReportStatus, { color: string; icon: React.ReactNode; tKey: string }> = {
  DRAFT: { color: 'bg-gray-100 text-gray-700', icon: <Clock className="h-3.5 w-3.5" />, tKey: 'statusDraft' },
  GENERATING: { color: 'bg-blue-100 text-blue-700', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, tKey: 'statusGenerating' },
  AWAITING_REVIEW: { color: 'bg-amber-100 text-amber-700', icon: <Eye className="h-3.5 w-3.5" />, tKey: 'statusAwaitingReview' },
  PUBLISHED: { color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3.5 w-3.5" />, tKey: 'statusPublished' },
  FAILED: { color: 'bg-red-100 text-red-700', icon: <XCircle className="h-3.5 w-3.5" />, tKey: 'statusFailed' },
};

const SECTION_STATUS_ICON: Record<SectionStatus, { icon: React.ReactNode; color: string }> = {
  PENDING: { icon: <Clock className="h-4 w-4 text-gray-400" />, color: 'text-gray-400' },
  GENERATED: { icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, color: 'text-green-500' },
  AI_UNAVAILABLE: { icon: <XCircle className="h-4 w-4 text-amber-500" />, color: 'text-amber-500' },
  EDITED: { icon: <Pencil className="h-4 w-4 text-blue-500" />, color: 'text-blue-500' },
  APPROVED: { icon: <CheckCircle2 className="h-4 w-4 text-[#1F4E79]" />, color: 'text-[#1F4E79]' },
};

const SECTION_TYPE_BADGE: Record<SectionType, { label: string; color: string }> = {
  AI_GENERATED_FROM_DATA: { label: 'AI', color: 'bg-green-100 text-green-700' },
  INDICATORS_TABLE: { label: 'DATA', color: 'bg-blue-100 text-blue-700' },
  MAP_AND_TABLE: { label: 'DATA', color: 'bg-blue-100 text-blue-700' },
  COVER: { label: 'MANUAL', color: 'bg-gray-100 text-gray-600' },
  EXECUTIVE_SUMMARY: { label: 'AI', color: 'bg-green-100 text-green-700' },
  RECOMMENDATIONS: { label: 'AI', color: 'bg-green-100 text-green-700' },
  ANNEX: { label: 'MANUAL', color: 'bg-gray-100 text-gray-600' },
  FREE_TEXT: { label: 'MANUAL', color: 'bg-gray-100 text-gray-600' },
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ReportDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations('reports');
  const locale = useLocaleStore((s) => s.locale);

  const { data: reportData, isLoading } = useReportV2(id);
  const report = (reportData as any)?.data;

  const isGenerating = report?.status === 'GENERATING';

  // Polling for generation status
  const { data: statusData } = useReportStatus(id, isGenerating);
  const genStatus = (statusData as any)?.data;

  // Mutations
  const approveMutation = useApproveReport();
  const publishMutation = usePublishReport();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <Link href="/reports" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
          {t('backToReports')}
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
            {t('reportNotFound')}
          </p>
        </div>
      </div>
    );
  }

  const title = locale === 'fr' ? report.titleFr : report.titleEn;
  const statusCfg = STATUS_BADGE[report.status as ReportStatus] ?? STATUS_BADGE.DRAFT;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/reports" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
        <ArrowLeft className="h-4 w-4" />
        {t('backToReports')}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', statusCfg.color)}>
              {statusCfg.icon}
              {t(statusCfg.tKey)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {report.type} | {report.scope}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(report.periodStart).toLocaleDateString()} - {new Date(report.periodEnd).toLocaleDateString()}
            </span>
          </div>
        </div>
        {/* Action buttons */}
        {(report.status === 'AWAITING_REVIEW' || report.status === 'PUBLISHED') && (
          <div className="flex flex-wrap items-center gap-2">
            {report.status === 'AWAITING_REVIEW' && (
              <button
                onClick={() => approveMutation.mutate(id)}
                disabled={approveMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a4268] disabled:opacity-50"
              >
                {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t('approve')}
              </button>
            )}
            {report.status === 'AWAITING_REVIEW' && (
              <button
                onClick={() => publishMutation.mutate(id)}
                disabled={publishMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A227] px-4 py-2 text-sm font-medium text-white hover:bg-[#b8921f] disabled:opacity-50"
              >
                {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t('publish')}
              </button>
            )}
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <Download className="h-4 w-4" />
              DOCX
            </button>
          </div>
        )}
      </div>

      {/* ── Generating state ── */}
      {isGenerating && (
        <GeneratingView genStatus={genStatus} t={t} locale={locale} />
      )}

      {/* ── Sections list (after generation) ── */}
      {report.status !== 'GENERATING' && report.sections && report.sections.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('reportSections')} ({report.sections.length})
          </h2>
          {report.sections
            .sort((a: ReportSection, b: ReportSection) => a.displayOrder - b.displayOrder)
            .map((section: ReportSection) => (
              <SectionCard
                key={section.id}
                section={section}
                reportId={id}
                locale={locale}
                t={t}
              />
            ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Generating view                                                    */
/* ------------------------------------------------------------------ */

function GeneratingView({
  genStatus,
  t,
  locale,
}: {
  genStatus: any;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const completed = genStatus?.sectionsCompleted ?? 0;
  const total = genStatus?.sectionsTotal ?? 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const sections = genStatus?.sections ?? [];

  const elapsedStr = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6 dark:border-blue-900 dark:bg-blue-950/30">
      <div className="flex items-center gap-3 mb-4">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
          {t('generationInProgress')}
        </h2>
        <span className="ml-auto text-sm text-blue-600">
          {elapsedStr}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-blue-700 mb-1">
          <span>{completed}/{total} {t('sectionsCompleted')}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-blue-100">
          <div
            className="h-2 rounded-full bg-[#1F4E79] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Section status list */}
      {sections.length > 0 && (
        <div className="space-y-1.5">
          {sections.map((s: { code: string; status: SectionStatus }) => {
            const statusIcon = SECTION_STATUS_ICON[s.status] ?? SECTION_STATUS_ICON.PENDING;
            return (
              <div key={s.code} className="flex items-center gap-2 text-sm">
                {s.status === 'PENDING' ? (
                  <Clock className="h-4 w-4 text-gray-400" />
                ) : s.status === 'GENERATED' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                )}
                <span className={cn('text-sm', s.status === 'PENDING' ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300')}>
                  {s.code}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section card                                                       */
/* ------------------------------------------------------------------ */

function SectionCard({
  section,
  reportId,
  locale,
  t,
}: {
  section: ReportSection;
  reportId: string;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(section.contentHtml ?? '');

  const editMutation = useEditReportSection();
  const regenerateMutation = useRegenerateSection();

  const sectionTitle = locale === 'fr' ? section.titleFr : section.titleEn;
  const typeBadge = SECTION_TYPE_BADGE[section.sectionType] ?? SECTION_TYPE_BADGE.FREE_TEXT;
  const statusIcon = SECTION_STATUS_ICON[section.status] ?? SECTION_STATUS_ICON.PENDING;

  function handleSaveEdit() {
    editMutation.mutate(
      { reportId, code: section.code, contentHtml: editContent },
      { onSuccess: () => setEditing(false) },
    );
  }

  function handleRegenerate() {
    regenerateMutation.mutate({ reportId, code: section.code });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        {statusIcon.icon}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {sectionTitle}
          </h3>
          <div className="mt-0.5 flex items-center gap-2">
            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', typeBadge.color)}>
              {typeBadge.label}
            </span>
            <span className="text-[10px] text-gray-400 uppercase">
              {section.status}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setEditing(!editing)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <Edit3 className="h-3 w-3" />
            {t('editSection')}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={regenerateMutation.isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {regenerateMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {t('regenerate')}
          </button>
        </div>
      </div>

      {/* Content / Editor */}
      {editing ? (
        <div className="border-t border-gray-100 p-4 dark:border-gray-700">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={12}
            className="w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={editMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a4268] disabled:opacity-50"
            >
              {editMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {t('save')}
            </button>
            <button
              onClick={() => { setEditing(false); setEditContent(section.contentHtml ?? ''); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
            >
              <X className="h-3.5 w-3.5" />
              {t('cancelEdit')}
            </button>
          </div>
          {editMutation.isError && (
            <p className="mt-2 text-sm text-red-600">
              {editMutation.error instanceof Error ? editMutation.error.message : t('editError')}
            </p>
          )}
        </div>
      ) : section.contentHtml ? (
        <div className="border-t border-gray-100 p-4 dark:border-gray-700">
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: section.contentHtml }}
          />
        </div>
      ) : null}

      {/* Expandable details */}
      {(section.promptUsed || section.tokensUsed || section.resolvedData) && (
        <div className="border-t border-gray-50 dark:border-gray-700">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {t('technicalDetails')}
          </button>
          {expanded && (
            <div className="px-4 pb-4 space-y-3">
              {section.promptUsed && (
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">{t('promptUsed')}</p>
                  <pre className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600 overflow-x-auto dark:bg-gray-900 dark:text-gray-400">
                    {section.promptUsed}
                  </pre>
                </div>
              )}
              {section.tokensUsed != null && (
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">{t('tokensUsed')}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{section.tokensUsed.toLocaleString()}</p>
                </div>
              )}
              {section.resolvedData && (
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">{t('resolvedData')}</p>
                  <pre className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600 overflow-x-auto max-h-60 dark:bg-gray-900 dark:text-gray-400">
                    {JSON.stringify(section.resolvedData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
