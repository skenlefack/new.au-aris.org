'use client';

// Knowledge categories — admin management.
//
// Continental managers (KNOWLEDGE_MANAGER, CONTINENTAL_ADMIN, SUPER_ADMIN)
// can create / edit / delete categories at any scope. REC and Country users
// see only the categories at their own level and can manage their own ones.
// The page renders a modern table with inline create / edit form (no modal).

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Lock,
  ClipboardCheck,
  Clock,
  ArrowLeft,
  FolderTree,
  Search,
  X,
  Check,
  AlertCircle,
  FileText,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useCategoryTree,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCategoryReviewQueue,
  type KnowledgeCategory,
  type CategoryScope,
} from '@/lib/api/knowledge-hub-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RecCountryPicker } from '@/components/knowledge/RecCountryPicker';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { useTranslations } from '@/lib/i18n/translations';

const REVIEWER_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'KNOWLEDGE_MANAGER']);

const INPUT_CLS =
  'w-full rounded-lg border bg-card px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

type ViewMode = 'list' | 'create' | 'edit';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Render a Lucide icon by name, falling back to FolderTree. */
function CategoryIcon({ name, color, className }: { name: string | null; color: string | null; className?: string }) {
  const Icon =
    name && (LucideIcons as Record<string, unknown>)[name]
      ? ((LucideIcons as Record<string, unknown>)[name] as React.ComponentType<{ className?: string }>)
      : FolderTree;
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${className ?? ''}`}
      style={color ? { backgroundColor: `${color}15`, borderColor: `${color}40`, color } : undefined}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

const SCOPE_STYLES: Record<CategoryScope, string> = {
  CONTINENTAL: 'bg-purple-50 text-purple-700 ring-purple-200',
  REC: 'bg-blue-50 text-blue-700 ring-blue-200',
  COUNTRY: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

function ScopeBadge({ scope }: { scope: CategoryScope }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${SCOPE_STYLES[scope]}`}
    >
      {scope}
    </span>
  );
}

function StatusBadge({ status }: { status: KnowledgeCategory['status'] }) {
  if (status === 'APPROVED')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
        <Check className="h-3 w-3" /> Approved
      </span>
    );
  if (status === 'PENDING')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
      <X className="h-3 w-3" /> Rejected
    </span>
  );
}

/** Flatten the tree to a row list, respecting collapsed parents. */
interface FlatRow {
  cat: KnowledgeCategory;
  depth: number;
  hasChildren: boolean;
}

function flattenTree(
  nodes: KnowledgeCategory[],
  collapsed: Set<string>,
  depth = 0,
  out: FlatRow[] = [],
): FlatRow[] {
  for (const cat of nodes) {
    const hasChildren = (cat.children?.length ?? 0) > 0;
    out.push({ cat, depth, hasChildren });
    if (hasChildren && !collapsed.has(cat.id)) {
      flattenTree(cat.children!, collapsed, depth + 1, out);
    }
  }
  return out;
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function CategoriesAdminPage() {
  const t = useTranslations('knowledge');
  const user = useAuthStore((s) => s.user);
  const isReviewer = !!user?.roles?.some((r) => REVIEWER_ROLES.has(r));
  const isContinental = user?.tenantLevel === 'CONTINENTAL';
  const isManager = isReviewer || isContinental;

  // Non-managers only see categories at their own level. Managers see the
  // whole tree.
  const treeScope: CategoryScope | undefined = useMemo(() => {
    if (isManager) return undefined;
    if (user?.tenantLevel === 'REC') return 'REC';
    if (user?.tenantLevel === 'MEMBER_STATE') return 'COUNTRY';
    return undefined;
  }, [isManager, user?.tenantLevel]);

  const tree = useCategoryTree({ withCounts: true, scope: treeScope });
  const queue = useCategoryReviewQueue();
  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();
  const deleteMut = useDeleteCategory();

  const [view, setView] = useState<ViewMode>('list');
  const [editing, setEditing] = useState<KnowledgeCategory | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Default scope for the proposal form, derived from the user's tenant level
  const defaultScope: CategoryScope = useMemo(() => {
    if (isManager) return 'CONTINENTAL';
    if (user?.tenantLevel === 'REC') return 'REC';
    return 'COUNTRY';
  }, [isManager, user?.tenantLevel]);

  // Whether the *current user* is allowed to edit/delete a given category
  const canManageCategory = (cat: KnowledgeCategory): boolean => {
    if (cat.isSystem && !isManager) return false;
    if (isManager) return true;
    if (user?.tenantLevel === 'REC' && cat.scope === 'REC' && cat.scopeTenantId === user.tenantId) return true;
    if (user?.tenantLevel === 'MEMBER_STATE' && cat.scope === 'COUNTRY' && cat.scopeTenantId === user.tenantId) return true;
    return false;
  };

  const openCreate = () => {
    setEditing(null);
    setView('create');
  };
  const openEdit = (cat: KnowledgeCategory) => {
    setEditing(cat);
    setView('edit');
  };
  const backToList = () => {
    setEditing(null);
    setView('list');
  };

  const handleDelete = async (cat: KnowledgeCategory) => {
    if ((cat.publicationCount ?? 0) > 0) {
      toast.error(t('catDeleteHasPublications'), {
        description: t('catDeleteHasPublicationsDesc', { count: String(cat.publicationCount ?? 0) }),
        icon: <AlertCircle className="h-4 w-4" />,
      });
      return;
    }
    if (cat.isSystem) {
      toast.error(t('catDeleteSystem'), {
        description: t('catDeleteSystemDesc'),
      });
      return;
    }
    const ok = window.confirm(t('catDeleteConfirm', { name: cat.nameEn }));
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(cat.id);
      toast.success(t('catDeleteSuccess'), { description: t('catDeleteSuccessDesc', { name: cat.nameEn }) });
    } catch (err) {
      toast.error(t('catDeleteFailed'), {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleSave = async (input: any) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...input });
        toast.success(t('catUpdateSuccess'), { description: `"${input.nameEn ?? editing.nameEn}" saved.` });
      } else {
        await createMut.mutateAsync(input);
        toast.success(
          isManager ? t('catCreateSuccess') : t('catProposeSuccess'),
          {
            description: isManager
              ? `"${input.nameEn}" is now available.`
              : t('catProposeSuccessDesc'),
          },
        );
      }
      backToList();
    } catch (err) {
      toast.error(t('catSaveFailed'), {
        description: err instanceof Error ? err.message : t('catSaveFailedDesc'),
      });
      throw err;
    }
  };

  // ── Filter & flatten tree for the table ──
  const allRoots = tree.data?.data ?? [];
  const filteredRoots = useMemo(() => {
    if (!search.trim()) return allRoots;
    const q = search.toLowerCase();
    const matches = (c: KnowledgeCategory): boolean =>
      c.nameEn.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      (c.children ?? []).some(matches);
    const filterTree = (nodes: KnowledgeCategory[]): KnowledgeCategory[] =>
      nodes
        .filter(matches)
        .map((c) => ({ ...c, children: c.children ? filterTree(c.children) : [] }));
    return filterTree(allRoots);
  }, [allRoots, search]);

  const allRows = useMemo(
    () => flattenTree(filteredRoots, collapsed),
    [filteredRoots, collapsed],
  );

  // Reset page when search or data changes
  const totalRows = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => allRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [allRows, safePage, pageSize],
  );
  const rows = paginatedRows;

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────

  if (view !== 'list') {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <button
            onClick={backToList}
            className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('catBackToList')}
          </button>
          <div>
            <h1 className="text-2xl font-bold">
              {editing ? t('catEditTitle') : isManager ? t('catNewTitle') : t('catProposeTitle')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {editing
                ? t('catEditDesc', { name: editing.nameEn })
                : isManager
                ? t('catNewDesc')
                : t('catProposeDesc')}
            </p>
          </div>
        </div>

        <CategoryForm
          initial={editing}
          isManager={isManager}
          defaultScope={defaultScope}
          userTenantId={user?.tenantId}
          allCategories={allRoots}
          onCancel={backToList}
          onSave={handleSave}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('catPageTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isManager ? t('catPageDesc') : t('catPageDescLimited')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (queue.data?.data?.length ?? 0) > 0 && (
            <Link
              href="/knowledge/admin/categories/review"
              className="inline-flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100"
            >
              <ClipboardCheck className="h-4 w-4" />
              {t('catReviewQueue')} ({queue.data!.data.length})
            </Link>
          )}
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {isManager ? t('catNewCategory') : t('catProposeCategory')}
          </button>
        </div>
      </div>

      {!isManager && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <Shield className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">{t('catScopedView')}</p>
            <p className="mt-0.5 text-blue-800">
              {t('catScopedDesc', { level: user?.tenantLevel === 'REC' ? 'REC' : 'country' })}
            </p>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('catSearchPlaceholder')}
          className="w-full rounded-md border bg-card py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-14 px-4 py-3 text-left"></th>
              <th className="px-2 py-3 text-left font-semibold">{t('catColCategory')}</th>
              <th className="px-2 py-3 text-left font-semibold">{t('catColScope')}</th>
              <th className="px-2 py-3 text-left font-semibold">{t('catColPublications')}</th>
              <th className="px-2 py-3 text-left font-semibold">{t('catColStatus')}</th>
              <th className="w-32 px-4 py-3 text-right font-semibold">{t('catColActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tree.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  {t('catLoading')}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <FolderTree className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">{t('catEmpty')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {search
                      ? t('catEmptySearch')
                      : isManager
                      ? t('catEmptyCreate')
                      : t('catEmptyPropose')}
                  </p>
                </td>
              </tr>
            ) : (
              rows.map(({ cat, depth, hasChildren }) => {
                const canEdit = canManageCategory(cat);
                const isCollapsed = collapsed.has(cat.id);
                const cannotDelete = (cat.publicationCount ?? 0) > 0 || cat.isSystem;
                return (
                  <tr key={cat.id} className="group transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <CategoryIcon name={cat.icon} color={cat.color} />
                    </td>
                    <td className="px-2 py-3">
                      <div
                        className="flex items-center gap-2"
                        style={{ paddingLeft: `${depth * 1.75}rem` }}
                      >
                        {depth > 0 && (
                          <span
                            className="mr-1 inline-block h-px w-4 bg-border"
                            aria-hidden
                          />
                        )}
                        {hasChildren ? (
                          <button
                            onClick={() => toggleCollapse(cat.id)}
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <span className="inline-block w-5" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-foreground">{cat.nameEn}</span>
                            {cat.isSystem && (
                              <span title="System category">
                                <Lock className="h-3 w-3 text-muted-foreground" />
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{cat.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <ScopeBadge scope={cat.scope} />
                    </td>
                    <td className="px-2 py-3">
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium tabular-nums">{cat.publicationCount ?? 0}</span>
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <StatusBadge status={cat.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(cat)}
                          disabled={!canEdit}
                          title={canEdit ? 'Edit' : 'You cannot edit this category'}
                          className="rounded-md p-2 text-muted-foreground transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat)}
                          disabled={!canEdit || cannotDelete}
                          title={
                            !canEdit
                              ? 'You cannot delete this category'
                              : cat.isSystem
                              ? 'System categories cannot be deleted'
                              : (cat.publicationCount ?? 0) > 0
                              ? `Cannot delete — ${cat.publicationCount} publication(s) attached`
                              : 'Delete'
                          }
                          className="rounded-md p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* ── Pagination ── */}
        {totalRows > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t('catShowPerPage')}</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="rounded-md border bg-card px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {[5, 10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>{t('catPerPage')}</span>
              <span className="ml-2 text-xs">
                ({(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalRows)} of {totalRows})
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={safePage <= 1}
                className="rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('catFirst')}
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (safePage <= 3) {
                  pageNum = i + 1;
                } else if (safePage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = safePage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                      pageNum === safePage
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-muted'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage >= totalPages}
                className="rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('catLast')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline Form ────────────────────────────────────────────────────────────

function CategoryForm({
  initial,
  isManager,
  defaultScope,
  userTenantId,
  allCategories,
  onCancel,
  onSave,
}: {
  initial: KnowledgeCategory | null;
  isManager: boolean;
  defaultScope: CategoryScope;
  userTenantId: string | undefined;
  allCategories: KnowledgeCategory[];
  onCancel: () => void;
  onSave: (input: any) => Promise<void>;
}) {
  const t = useTranslations('knowledge');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [name, setName] = useState<Record<string, string>>({
    en: initial?.nameEn ?? '', fr: initial?.nameFr ?? '',
    pt: initial?.namePt ?? '', ar: initial?.nameAr ?? '',
    es: initial?.nameEs ?? '', sw: initial?.nameSw ?? '',
  });
  const [parentId, setParentId] = useState<string | null>(initial?.parentId ?? null);
  const [scope, setScope] = useState<CategoryScope>(initial?.scope ?? defaultScope);
  const [scopeTenantId, setScopeTenantId] = useState(
    initial?.scopeTenantId ?? (isManager ? '' : userTenantId ?? ''),
  );
  const [recParentTenantId, setRecParentTenantId] = useState(initial?.recParentTenantId ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '');
  const [color, setColor] = useState(initial?.color ?? '#6366f1');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(name.en || name.fr || '').trim()) {
      toast.error(t('catNameRequired'));
      return;
    }
    if (!initial && !slug.trim()) {
      toast.error(t('catSlugRequired'));
      return;
    }
    setBusy(true);
    try {
      const payload: any = {
        nameEn: (name.en || name.fr || '').trim(),
        nameFr: name.fr?.trim() || undefined,
        namePt: name.pt?.trim() || undefined,
        nameAr: name.ar?.trim() || undefined,
        nameEs: name.es?.trim() || undefined,
        nameSw: name.sw?.trim() || undefined,
        parentId: parentId ?? undefined,
        icon: icon.trim() || undefined,
        color: color.trim() || undefined,
      };
      if (!initial) {
        payload.slug = slug.trim();
        payload.scope = scope;
        payload.scopeTenantId = scopeTenantId || undefined;
        payload.recParentTenantId = recParentTenantId || undefined;
      }
      await onSave(payload);
    } catch {
      // toast already shown by onSave
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {/* ── Identity ── */}
      <FormSection title={t('catIdentity')} description={t('catIdentityDesc')}>
        {!initial && (
          <Field label={t('catSlugLabel')} required hint={t('catSlugHint')}>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="my-new-category"
              className={INPUT_CLS}
            />
          </Field>
        )}

        <MultilingualInput
          label={t('catNameLabel')}
          value={name}
          onChange={setName}
          required
        />

        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <Field label={t('catIconLabel')} hint="e.g. Heart, Activity, FlaskConical">
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="FolderTree"
              className={INPUT_CLS}
            />
          </Field>
          <Field label={t('catColorLabel')}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded-md border bg-card"
            />
          </Field>
          <Field label={t('catPreviewLabel')}>
            <CategoryIcon name={icon || null} color={color || null} />
          </Field>
        </div>
      </FormSection>

      {/* ── Hierarchy ── */}
      <section className="space-y-4" style={{ overflow: 'visible' }}>
        <div className="border-b pb-2">
          <h2 className="text-base font-semibold">{t('catHierarchy')}</h2>
          <p className="text-xs text-muted-foreground">{t('catHierarchyDesc')}</p>
        </div>
        <div className="space-y-4">
        <Field label={t('catParentLabel')} hint={t('catParentHint')}>
          <CategoryTreePicker
            categories={allCategories}
            value={parentId}
            onChange={setParentId}
            excludeId={initial?.id}
          />
        </Field>
        </div>
      </section>

      {/* ── Scope ── */}
      {!initial && (
        <FormSection title={t('catScope')} description={t('catScopeDesc')}>
          {isManager ? (
            <>
              <Field label={t('catScopeLabel')}>
                <select
                  value={scope}
                  onChange={(e) => {
                    const next = e.target.value as CategoryScope;
                    setScope(next);
                    if (next === 'CONTINENTAL') {
                      setScopeTenantId('');
                      setRecParentTenantId('');
                    }
                  }}
                  className={INPUT_CLS}
                >
                  <option value="CONTINENTAL">{t('catScopeContinent')}</option>
                  <option value="REC">{t('catScopeRec')}</option>
                  <option value="COUNTRY">{t('catScopeCountry')}</option>
                </select>
              </Field>
              {scope === 'REC' && (
                <RecCountryPicker
                  mode="rec"
                  recTenantId={scopeTenantId || null}
                  onRecChange={(id) => setScopeTenantId(id ?? '')}
                />
              )}
              {scope === 'COUNTRY' && (
                <RecCountryPicker
                  mode="country"
                  recTenantId={recParentTenantId || null}
                  onRecChange={(id) => {
                    setRecParentTenantId(id ?? '');
                    setScopeTenantId('');
                  }}
                  countryTenantId={scopeTenantId || null}
                  onCountryChange={(id) => setScopeTenantId(id ?? '')}
                />
              )}
            </>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Scope: <ScopeBadge scope={scope} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Automatically set to your {scope === 'REC' ? 'REC' : 'country'}. Your proposal will
                be reviewed by the continental knowledge manager.
              </p>
            </div>
          )}
        </FormSection>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          {t('catCancel')}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? t('catSaving') : initial ? t('catSaveChanges') : isManager ? t('catCreateCategory') : t('catSubmitProposal')}
        </button>
      </div>

    </form>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="border-b pb-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Searchable tree picker for parent category ────────────────────────────

function CategoryTreePicker({
  categories,
  value,
  onChange,
  excludeId,
}: {
  categories: KnowledgeCategory[];
  value: string | null;
  onChange: (id: string | null) => void;
  excludeId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Find selected category in the (possibly nested) tree
  const findCat = (nodes: KnowledgeCategory[], id: string): KnowledgeCategory | null => {
    for (const c of nodes) {
      if (c.id === id) return c;
      if (c.children?.length) {
        const f = findCat(c.children, id);
        if (f) return f;
      }
    }
    return null;
  };

  const selected = value ? findCat(categories, value) : null;

  // Exclude the editing category and its descendants (cannot be its own parent)
  const collectDescendantIds = (cat: KnowledgeCategory, acc: Set<string>): Set<string> => {
    acc.add(cat.id);
    cat.children?.forEach((c) => collectDescendantIds(c, acc));
    return acc;
  };
  const excludedIds = useMemo(() => {
    if (!excludeId) return new Set<string>();
    const target = findCat(categories, excludeId);
    return target ? collectDescendantIds(target, new Set()) : new Set<string>();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludeId, categories]);

  // Filter tree by search query (keep matching nodes + their ancestors)
  const filteredTree = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    const filterNodes = (nodes: KnowledgeCategory[]): KnowledgeCategory[] => {
      const out: KnowledgeCategory[] = [];
      for (const c of nodes) {
        const children = c.children ? filterNodes(c.children) : [];
        const selfMatch = c.nameEn.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
        if (selfMatch || children.length > 0) {
          out.push({ ...c, children });
        }
      }
      return out;
    };
    return filterNodes(categories);
  }, [categories, search]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
      >
        {selected ? (
          <span className="flex items-center gap-2">
            <CategoryIcon name={selected.icon} color={selected.color} className="!h-7 !w-7" />
            <span className="font-medium">{selected.nameEn}</span>
            <ScopeBadge scope={selected.scope} />
          </span>
        ) : (
          <span className="text-muted-foreground">— No parent (top-level) —</span>
        )}
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* click-outside backdrop */}
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-[70] mt-2 max-h-96 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b bg-white p-2 dark:bg-gray-900">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search categories…"
                  className="w-full rounded-md border bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-gray-900"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto bg-white p-1 dark:bg-gray-900">
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setSearch('');
                }}
                className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent ${
                  value === null ? 'bg-primary/10 text-primary' : ''
                }`}
              >
                <X className="h-4 w-4 text-muted-foreground" />
                <em>No parent (top-level)</em>
              </button>
              {filteredTree.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No matches</p>
              ) : (
                <TreePickerNodes
                  nodes={filteredTree}
                  depth={0}
                  selectedId={value}
                  excludedIds={excludedIds}
                  onPick={(id) => {
                    onChange(id);
                    setOpen(false);
                    setSearch('');
                  }}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TreePickerNodes({
  nodes,
  depth,
  selectedId,
  excludedIds,
  onPick,
}: {
  nodes: KnowledgeCategory[];
  depth: number;
  selectedId: string | null;
  excludedIds: Set<string>;
  onPick: (id: string) => void;
}) {
  return (
    <>
      {nodes.map((cat) => {
        const disabled = excludedIds.has(cat.id);
        const isSelected = selectedId === cat.id;
        return (
          <div key={cat.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(cat.id)}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition ${
                isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
              } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
              style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}
            >
              {depth > 0 && <span className="text-muted-foreground">└</span>}
              <CategoryIcon name={cat.icon} color={cat.color} className="!h-6 !w-6" />
              <span className="flex-1 truncate font-medium">{cat.nameEn}</span>
              <ScopeBadge scope={cat.scope} />
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </button>
            {cat.children && cat.children.length > 0 && (
              <TreePickerNodes
                nodes={cat.children}
                depth={depth + 1}
                selectedId={selectedId}
                excludedIds={excludedIds}
                onPick={onPick}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
