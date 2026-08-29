'use client';

// KNOWLEDGE_MANAGER review queue. Lists all SUBMITTED + UNDER_REVIEW publications
// across the system; clicking opens a side panel with full content + accept/reject
// actions and a bidirectional comment thread.

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { useReviewQueue, useReviewPublication, usePublishPublication, pickLocale } from '@/lib/api/knowledge-hub-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';

export default function ReviewQueuePage() {
  const t = useTranslations('knowledge');
  const locale = useAuthStore((s) => s.user?.locale ?? 'en');
  const queue = useReviewQueue();
  const reviewMut = useReviewPublication();
  const publishMut = usePublishPublication();
  const [comment, setComment] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = queue.data?.data.find((p) => p.id === activeId);

  const decide = async (decision: 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGES') => {
    if (!activeId) return;
    await reviewMut.mutateAsync({ id: activeId, decision, comment: comment || undefined });
    if (decision === 'APPROVED') {
      // auto-publish on approve (continental editor decision)
      await publishMut.mutateAsync(activeId);
    }
    setComment('');
    setActiveId(null);
  };

  return (
    <div className="grid h-screen grid-cols-12 gap-0">
      <aside className="col-span-4 overflow-y-auto border-r bg-card">
        <header className="border-b p-4">
          <h1 className="text-lg font-semibold">{t('reviewQueueTitle')}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('reviewQueueDesc', { count: String(queue.data?.data.length ?? 0) })}
          </p>
        </header>
        <ul className="divide-y">
          {(queue.data?.data ?? []).map((pub) => (
            <li key={pub.id}>
              <button
                onClick={() => setActiveId(pub.id)}
                className={`w-full p-4 text-left hover:bg-accent ${activeId === pub.id ? 'bg-accent' : ''}`}
              >
                <div className="font-medium">{pickLocale(pub.title, locale) || pub.slug}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5">{pub.type}</span>
                  <span>{pub.category?.nameEn}</span>
                  {pub.submittedAt && <span>· {new Date(pub.submittedAt).toLocaleDateString()}</span>}
                </div>
              </button>
            </li>
          ))}
          {(queue.data?.data?.length ?? 0) === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">{t('reviewQueueEmpty')}</li>
          )}
        </ul>
      </aside>

      <section className="col-span-8 overflow-y-auto">
        {active ? (
          <article className="p-8">
            <div className="mb-4 text-xs text-muted-foreground">
              {active.category?.nameEn} · {active.type} · submitted {active.submittedAt && new Date(active.submittedAt).toLocaleString()}
            </div>
            <h1 className="mb-2 text-3xl font-bold">{pickLocale(active.title, locale)}</h1>
            {active.summary && <p className="mb-6 text-lg text-muted-foreground">{pickLocale(active.summary, locale)}</p>}

            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: pickLocale(active.contentHtml, locale) }} />

            {active.attachments && active.attachments.length > 0 && (
              <div className="mt-6 rounded-lg border bg-card p-4">
                <h3 className="mb-2 text-sm font-semibold">{t('reviewAttachments')}</h3>
                <ul className="space-y-1">
                  {active.attachments.map((a) => (
                    <li key={a.id} className="text-sm">
                      <Link href={`/api/v1/drive/files/${a.fileId}/download`} className="text-primary hover:underline">
                        {a.kind} · {a.caption || a.fileId}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(active.reviews?.length ?? 0) > 0 && (
              <div className="mt-6 rounded-lg border bg-card p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4" /> {t('reviewHistory')}
                </h3>
                <ul className="space-y-2">
                  {active.reviews!.map((r) => (
                    <li key={r.id} className="rounded border-l-2 border-primary bg-muted/30 p-2 text-xs">
                      <div className="font-medium">
                        {r.decision} — {r.reviewerRole}
                      </div>
                      {r.comment && <div className="mt-1 text-muted-foreground">{r.comment}</div>}
                      <div className="mt-1 text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action panel */}
            <div className="sticky bottom-0 mt-8 -mx-8 border-t bg-card p-6">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('reviewCommentPlaceholder')}
                rows={3}
                className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => decide('APPROVED')}
                  disabled={reviewMut.isPending || publishMut.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" /> {t('reviewApprove')}
                </button>
                <button
                  onClick={() => decide('REQUEST_CHANGES')}
                  disabled={reviewMut.isPending}
                  className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
                >
                  <MessageSquare className="h-4 w-4" /> {t('reviewRequestChanges')}
                </button>
                <button
                  onClick={() => decide('REJECTED')}
                  disabled={reviewMut.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" /> {t('reviewReject')}
                </button>
              </div>
            </div>
          </article>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t('reviewSelectHint')}
          </div>
        )}
      </section>
    </div>
  );
}
