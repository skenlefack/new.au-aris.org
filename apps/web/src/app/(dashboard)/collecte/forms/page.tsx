'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Clock,
  CheckCircle2,
  Archive,
  MoreHorizontal,
  Copy,
  Trash2,
  Eye,
  Edit3,
  SendHorizonal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useFormBuilderTemplates,
  useDuplicateFormTemplate,
  useDeleteFormTemplate,
  usePublishFormTemplate,
  useArchiveFormTemplate,
  type FormTemplateListItem,
} from '@/lib/api/form-builder-hooks';
import { DOMAIN_OPTIONS } from '@/components/form-builder/utils/field-types';
import { TableSkeleton } from '@/components/ui/Skeleton';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { label: 'Draft', color: 'bg-amber-100 text-amber-700', icon: <Clock className="h-3 w-3" /> },
  PUBLISHED: { label: 'Published', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  ARCHIVED: { label: 'Archived', color: 'bg-gray-100 text-gray-500', icon: <Archive className="h-3 w-3" /> },
};

export default function FormListPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useFormBuilderTemplates({
    page,
    limit: 20,
    status: statusFilter || undefined,
    domain: domainFilter || undefined,
  });

  const duplicateMutation = useDuplicateFormTemplate();
  const deleteMutation = useDeleteFormTemplate();
  const publishMutation = usePublishFormTemplate();
  const archiveMutation = useArchiveFormTemplate();

  const templates = data?.data ?? [];
  const meta = data?.meta;

  // Client-side search filter
  const filtered = search
    ? templates.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.domain.toLowerCase().includes(search.toLowerCase()),
      )
    : templates;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Form Builder</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create and manage no-code data collection forms
          </p>
        </div>
        <Link
          href="/collecte/forms/new"
          className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Form
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search forms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={domainFilter}
            onChange={(e) => { setDomainFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All domains</option>
            {DOMAIN_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Form List */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {filtered.map((template) => (
            <FormCard
              key={template.id}
              template={template}
              onDuplicate={() => duplicateMutation.mutate(template.id)}
              onDelete={() => {
                if (confirm('Delete this draft form?')) deleteMutation.mutate(template.id);
              }}
              onPublish={() => publishMutation.mutate(template.id)}
              onArchive={() => archiveMutation.mutate(template.id)}
            />
          ))}

          {/* Pagination */}
          {meta && meta.total > meta.limit && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">
                Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * meta.limit >= meta.total}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FormCard({
  template,
  onDuplicate,
  onDelete,
  onPublish,
  onArchive,
}: {
  template: FormTemplateListItem;
  onDuplicate: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onArchive: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const statusCfg = STATUS_CONFIG[template.status] || STATUS_CONFIG.DRAFT;
  const domainLabel = DOMAIN_OPTIONS.find((d) => d.value === template.domain)?.label || template.domain;

  // Count fields from schema
  let fieldCount = 0;
  let sectionCount = 0;
  try {
    const schema = template.schema as { sections?: Array<{ fields?: unknown[] }> };
    sectionCount = schema?.sections?.length || 0;
    fieldCount = schema?.sections?.reduce((sum, s) => sum + (s.fields?.length || 0), 0) || 0;
  } catch { /* ignore */ }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 flex-shrink-0 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {template.name}
            </h3>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', statusCfg.color)}>
              {statusCfg.icon}
              {statusCfg.label}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600 font-medium dark:bg-blue-900/30 dark:text-blue-400">
              {domainLabel}
            </span>
            <span>v{template.version}</span>
            <span>{sectionCount} sections</span>
            <span>{fieldCount} fields</span>
            <span>{new Date(template.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-4">
          <Link
            href={`/collecte/forms/${template.id}/preview`}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            title="Preview"
          >
            <Eye className="h-4 w-4" />
          </Link>
          {template.status === 'DRAFT' && (
            <Link
              href={`/collecte/forms/${template.id}/edit`}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              title="Edit"
            >
              <Edit3 className="h-4 w-4" />
            </Link>
          )}

          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {template.status === 'DRAFT' && (
                    <button
                      onClick={() => { onPublish(); setMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300"
                    >
                      <SendHorizonal className="h-3.5 w-3.5" /> Publish
                    </button>
                  )}
                  <button
                    onClick={() => { onDuplicate(); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300"
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </button>
                  {template.status === 'PUBLISHED' && (
                    <button
                      onClick={() => { onArchive(); setMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300"
                    >
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </button>
                  )}
                  {template.status === 'DRAFT' && (
                    <>
                      <hr className="my-1 border-gray-200 dark:border-gray-700" />
                      <button
                        onClick={() => { onDelete(); setMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
      <FileText className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
      <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">No forms yet</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Create your first data collection form using the no-code builder.
      </p>
      <Link
        href="/collecte/forms/new"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700"
      >
        <Plus className="h-4 w-4" />
        Create Form
      </Link>
    </div>
  );
}
