'use client';

// Category management — accessible to all admins.
//
// Continental managers (KNOWLEDGE_MANAGER, CONTINENTAL_ADMIN, SUPER_ADMIN)
// can create categories at any scope and approve them instantly. REC and
// COUNTRY users can *propose* categories scoped to their own tenant; the
// proposal goes to a continental review queue and only becomes usable for
// publishing once approved.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, Lock, ClipboardCheck, Clock } from 'lucide-react';
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

const REVIEWER_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'KNOWLEDGE_MANAGER']);

export default function CategoriesAdminPage() {
  const user = useAuthStore((s) => s.user);
  const isReviewer = !!user?.roles?.some((r) => REVIEWER_ROLES.has(r));
  const isContinental = user?.tenantLevel === 'CONTINENTAL';

  const tree = useCategoryTree({ withCounts: true });
  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();
  const deleteMut = useDeleteCategory();
  const queue = useCategoryReviewQueue();

  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeCategory | null>(null);

  const handleDelete = async (cat: KnowledgeCategory) => {
    if (!confirm(`Delete category "${cat.nameEn}"?`)) return;
    try {
      await deleteMut.mutateAsync(cat.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Default scope for the proposal form, derived from the user's tenant level
  const defaultScope: CategoryScope = useMemo(() => {
    if (isReviewer || isContinental) return 'CONTINENTAL';
    if (user?.tenantLevel === 'REC') return 'REC';
    return 'COUNTRY';
  }, [isReviewer, isContinental, user?.tenantLevel]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isReviewer
              ? 'Manage and validate the taxonomy used across the Knowledge Hub. System defaults cannot be deleted.'
              : 'Browse approved categories and propose new ones for your level. Continental managers will review your proposals.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isReviewer && (queue.data?.data?.length ?? 0) > 0 && (
            <Link
              href="/knowledge/admin/categories/review"
              className="inline-flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100"
            >
              <ClipboardCheck className="h-4 w-4" />
              Review queue ({queue.data!.data.length})
            </Link>
          )}
          <button
            onClick={() => setNewOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {isReviewer ? 'New category' : 'Propose category'}
          </button>
        </div>
      </div>

      {!isReviewer && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <strong>How it works:</strong> categories you propose are reviewed by the continental
          knowledge manager. Once approved they become available to everyone in your{' '}
          {user?.tenantLevel === 'REC' ? 'REC' : 'country'} for publishing content.
        </div>
      )}

      <div className="rounded-lg border bg-card p-4">
        {tree.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="space-y-1">
            {(tree.data?.data ?? []).map((cat) => (
              <CategoryNode key={cat.id} cat={cat} depth={0} onEdit={setEditing} onDelete={handleDelete} canManage={isReviewer} />
            ))}
          </ul>
        )}
      </div>

      {(newOpen || editing) && (
        <CategoryFormModal
          initial={editing}
          isReviewer={isReviewer}
          defaultScope={defaultScope}
          userTenantId={user?.tenantId}
          onClose={() => {
            setNewOpen(false);
            setEditing(null);
          }}
          onSave={async (input) => {
            if (editing) {
              await updateMut.mutateAsync({ id: editing.id, ...input });
            } else {
              await createMut.mutateAsync(input as any);
            }
            setNewOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryNode({
  cat, depth, onEdit, onDelete, canManage,
}: {
  cat: KnowledgeCategory;
  depth: number;
  onEdit: (c: KnowledgeCategory) => void;
  onDelete: (c: KnowledgeCategory) => void;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = (cat.children?.length ?? 0) > 0;

  return (
    <li>
      <div
        className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
        style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
      >
        <button onClick={() => setOpen(!open)} className="text-muted-foreground" disabled={!hasChildren}>
          {hasChildren ? open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" /> : <span className="inline-block w-4" />}
        </button>
        <span className="font-medium">{cat.nameEn}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{cat.scope}</span>
        {cat.status === 'PENDING' && (
          <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
            <Clock className="h-3 w-3" /> Pending
          </span>
        )}
        {cat.status === 'REJECTED' && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Rejected</span>
        )}
        {cat.publicationCount !== undefined && cat.publicationCount > 0 && (
          <span className="text-xs text-muted-foreground">({cat.publicationCount})</span>
        )}
        {cat.isSystem && <Lock className="h-3 w-3 text-muted-foreground" />}
        {canManage && (
          <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
            <button onClick={() => onEdit(cat)} className="rounded p-1 hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {!cat.isSystem && (
              <button onClick={() => onDelete(cat)} className="rounded p-1 text-red-600 hover:bg-muted">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
      {open && hasChildren && (
        <ul>
          {cat.children!.map((child) => (
            <CategoryNode key={child.id} cat={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} canManage={canManage} />
          ))}
        </ul>
      )}
    </li>
  );
}

function CategoryFormModal({
  initial, isReviewer, defaultScope, userTenantId, onClose, onSave,
}: {
  initial: KnowledgeCategory | null;
  isReviewer: boolean;
  defaultScope: CategoryScope;
  userTenantId: string | undefined;
  onClose: () => void;
  onSave: (input: any) => Promise<void>;
}) {
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? '');
  const [nameFr, setNameFr] = useState(initial?.nameFr ?? '');
  const [namePt, setNamePt] = useState(initial?.namePt ?? '');
  const [nameAr, setNameAr] = useState(initial?.nameAr ?? '');
  const [scope, setScope] = useState<CategoryScope>(initial?.scope ?? defaultScope);
  // Reviewers can target any scopeTenantId; non-reviewers are auto-scoped
  // server-side from their JWT, so we just send the user's own tenant.
  const [scopeTenantId, setScopeTenantId] = useState(initial?.scopeTenantId ?? (isReviewer ? '' : userTenantId ?? ''));
  const [recParentTenantId, setRecParentTenantId] = useState(initial?.recParentTenantId ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '');
  const [color, setColor] = useState(initial?.color ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await onSave({
        slug, nameEn, nameFr: nameFr || undefined, namePt: namePt || undefined, nameAr: nameAr || undefined,
        scope, scopeTenantId: scopeTenantId || undefined, recParentTenantId: recParentTenantId || undefined,
        icon: icon || undefined, color: color || undefined,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">
          {initial ? 'Edit category' : isReviewer ? 'New category' : 'Propose new category'}
        </h2>
        {!initial && !isReviewer && (
          <p className="mb-3 text-xs text-muted-foreground">
            Your proposal will be sent to the continental knowledge manager for approval.
          </p>
        )}
        {err && <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>}
        <div className="space-y-3">
          {!initial && (
            <div>
              <label className="mb-1 block text-xs font-medium">Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="my-new-category"
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          )}
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Name (EN)" className="w-full rounded border px-3 py-2 text-sm" />
          <input value={nameFr} onChange={(e) => setNameFr(e.target.value)} placeholder="Name (FR)" className="w-full rounded border px-3 py-2 text-sm" />
          <input value={namePt} onChange={(e) => setNamePt(e.target.value)} placeholder="Name (PT)" className="w-full rounded border px-3 py-2 text-sm" />
          <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="Name (AR)" className="w-full rounded border px-3 py-2 text-sm" />
          {!initial && isReviewer && (
            <>
              <select value={scope} onChange={(e) => setScope(e.target.value as CategoryScope)} className="w-full rounded border px-3 py-2 text-sm">
                <option value="CONTINENTAL">CONTINENTAL</option>
                <option value="REC">REC</option>
                <option value="COUNTRY">COUNTRY</option>
              </select>
              {scope !== 'CONTINENTAL' && (
                <input value={scopeTenantId} onChange={(e) => setScopeTenantId(e.target.value)} placeholder="Scope tenant id (UUID)" className="w-full rounded border px-3 py-2 text-sm" />
              )}
              {scope === 'COUNTRY' && (
                <input value={recParentTenantId} onChange={(e) => setRecParentTenantId(e.target.value)} placeholder="Parent REC tenant id (UUID)" className="w-full rounded border px-3 py-2 text-sm" />
              )}
            </>
          )}
          {!initial && !isReviewer && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              Scope: <strong>{scope}</strong> — automatically set to your{' '}
              {scope === 'REC' ? 'REC' : 'country'} based on your account.
            </div>
          )}
          <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Icon name (Lucide)" className="w-full rounded border px-3 py-2 text-sm" />
          <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#hex color" className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-1.5 text-sm hover:bg-accent">Cancel</button>
          <button onClick={submit} disabled={busy} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {busy ? 'Saving…' : isReviewer ? 'Save' : 'Submit proposal'}
          </button>
        </div>
      </div>
    </div>
  );
}
