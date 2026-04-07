'use client';

// Single publication detail / edit page (author or reviewer view).
// Shows status timeline, content, attachments, review history, and the
// available workflow actions for the current user.

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Trash2, Archive } from 'lucide-react';
import {
  usePublication,
  useSubmitPublication,
  useDeletePublication,
  useArchivePublication,
  pickLocale,
} from '@/lib/api/knowledge-hub-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';

const REVIEWER_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'KNOWLEDGE_MANAGER']);

export default function PublicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const locale = user?.locale ?? 'en';
  const isReviewer = !!user?.roles?.some((r) => REVIEWER_ROLES.has(r));

  const { data, isLoading } = usePublication(id);
  const submitMut = useSubmitPublication();
  const deleteMut = useDeletePublication();
  const archiveMut = useArchivePublication();

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!data?.data) return <p className="p-6 text-sm text-muted-foreground">Not found</p>;

  const pub = data.data;
  const isOwner = pub.createdBy === user?.id;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link href="/knowledge/admin/mine" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded bg-muted px-2 py-0.5">{pub.type}</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">{pub.status}</span>
          <span>· {pub.category?.nameEn}</span>
          <span>· {pub.visibility}</span>
        </div>
        <h1 className="text-3xl font-bold">{pickLocale(pub.title, locale)}</h1>
        {pub.summary && <p className="text-lg text-muted-foreground">{pickLocale(pub.summary, locale)}</p>}
      </header>

      {pub.rejectionReason && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>Reviewer feedback:</strong> {pub.rejectionReason}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-4">
        {(pub.status === 'DRAFT' || pub.status === 'REJECTED') && isOwner && (
          <button
            onClick={() => submitMut.mutate(pub.id)}
            disabled={submitMut.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Submit for review
          </button>
        )}
        {(isOwner || isReviewer) && (pub.status === 'DRAFT' || pub.status === 'REJECTED') && (
          <button
            onClick={async () => {
              if (!confirm('Delete this publication?')) return;
              await deleteMut.mutateAsync(pub.id);
              router.push('/knowledge/admin/mine');
            }}
            className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
        {isReviewer && pub.status === 'PUBLISHED' && (
          <button
            onClick={async () => {
              if (!confirm('Archive this publication?')) return;
              await archiveMut.mutateAsync(pub.id);
            }}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Archive className="h-4 w-4" /> Archive
          </button>
        )}
      </div>

      {/* Content */}
      <article className="prose max-w-none rounded-lg border bg-card p-6" dangerouslySetInnerHTML={{ __html: pickLocale(pub.contentHtml, locale) }} />

      {/* Attachments */}
      {pub.attachments && pub.attachments.length > 0 && (
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-3 text-sm font-semibold">Attachments</h2>
          <ul className="space-y-1">
            {pub.attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={`/api/v1/drive/files/${a.fileId}/download`}
                  className="text-sm text-primary hover:underline"
                >
                  {a.kind} — {a.caption || a.fileId}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Review trail */}
      {pub.reviews && pub.reviews.length > 0 && (
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-3 text-sm font-semibold">Review history</h2>
          <ul className="space-y-3">
            {pub.reviews.map((r) => (
              <li key={r.id} className="border-l-2 border-primary pl-3 text-sm">
                <div className="font-medium">{r.decision} — {r.reviewerRole}</div>
                {r.comment && <p className="mt-1 text-muted-foreground">{r.comment}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
