'use client';

// Continental review queue for proposed categories.
// Reserved to KNOWLEDGE_MANAGER + CONTINENTAL_ADMIN + SUPER_ADMIN.

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Folder } from 'lucide-react';
import { useCategoryReviewQueue, useReviewCategory } from '@/lib/api/knowledge-hub-hooks';

export default function CategoryReviewQueuePage() {
  const queue = useCategoryReviewQueue();
  const reviewMut = useReviewCategory();
  const [comment, setComment] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = queue.data?.data.find((c) => c.id === activeId);

  const decide = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!activeId) return;
    try {
      await reviewMut.mutateAsync({ id: activeId, decision, comment: comment || undefined });
      setComment('');
      setActiveId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Review failed');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href="/knowledge/admin/categories"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to categories
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Category review queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve or reject categories proposed by REC and country users.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* List */}
        <section className="rounded-lg border bg-card">
          <header className="border-b p-4">
            <h2 className="text-sm font-semibold">
              {queue.data?.data.length ?? 0} category(ies) pending
            </h2>
          </header>
          {queue.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : (queue.data?.data?.length ?? 0) === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Queue is empty 🎉</p>
          ) : (
            <ul className="divide-y">
              {queue.data!.data.map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => setActiveId(cat.id)}
                    className={`w-full p-4 text-left hover:bg-accent ${
                      activeId === cat.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Folder className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium">{cat.nameEn}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded bg-muted px-1.5 py-0.5">{cat.scope}</span>
                          <span>· slug: {cat.slug}</span>
                          {cat.submittedAt && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(cat.submittedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Detail */}
        <section className="rounded-lg border bg-card">
          {active ? (
            <div className="p-6">
              <h2 className="text-xl font-bold">{active.nameEn}</h2>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5">{active.scope}</span>
                <span>slug: <code>{active.slug}</code></span>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                {active.nameFr && <Row label="French" value={active.nameFr} />}
                {active.namePt && <Row label="Portuguese" value={active.namePt} />}
                {active.nameAr && <Row label="Arabic" value={active.nameAr} />}
                {active.scopeTenantId && <Row label="Scope tenant" value={active.scopeTenantId} />}
                {active.recParentTenantId && <Row label="Parent REC" value={active.recParentTenantId} />}
                {active.submittedBy && <Row label="Submitted by" value={active.submittedBy} />}
                {active.submittedAt && (
                  <Row label="Submitted" value={new Date(active.submittedAt).toLocaleString()} />
                )}
              </dl>

              <div className="mt-6">
                <label className="mb-1 block text-xs font-medium">Reviewer comment (optional)</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Add a note to the proposer…"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => decide('APPROVED')}
                  disabled={reviewMut.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
                <button
                  onClick={() => decide('REJECTED')}
                  disabled={reviewMut.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Select a category from the list to review
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="col-span-2 font-mono text-xs">{value}</dd>
    </div>
  );
}
