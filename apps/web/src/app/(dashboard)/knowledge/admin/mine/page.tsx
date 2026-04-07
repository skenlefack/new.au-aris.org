'use client';

// "My publications" — author dashboard listing every publication the current
// user has created, grouped by status.

import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { usePublications, pickLocale, type KnowledgePublication } from '@/lib/api/knowledge-hub-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Drafts',
  SUBMITTED: 'Awaiting review',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Needs revision',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export default function MyPublicationsPage() {
  const locale = useAuthStore((s) => s.user?.locale ?? 'en');
  const { data } = usePublications({ mine: true, limit: 100 });

  const grouped: Record<string, KnowledgePublication[]> = {};
  for (const pub of data?.data ?? []) {
    (grouped[pub.status] ??= []).push(pub);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My publications</h1>
        <Link
          href="/knowledge/admin/publications/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New publication
        </Link>
      </div>

      {Object.keys(STATUS_LABELS).map((status) => {
        const items = grouped[status] ?? [];
        if (items.length === 0) return null;
        return (
          <section key={status} className="rounded-lg border bg-card">
            <header className="border-b px-4 py-2 text-sm font-semibold">
              {STATUS_LABELS[status]} ({items.length})
            </header>
            <ul className="divide-y">
              {items.map((pub) => (
                <li key={pub.id} className="flex items-center justify-between p-4">
                  <div>
                    <Link
                      href={`/knowledge/admin/publications/${pub.id}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {pickLocale(pub.title, locale) || pub.slug}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {pub.type} · {pub.category?.nameEn ?? '—'} · updated {new Date(pub.updatedAt).toLocaleDateString()}
                    </div>
                    {pub.rejectionReason && (
                      <div className="mt-1 text-xs text-red-600">Reviewer: {pub.rejectionReason}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {(data?.data?.length ?? 0) === 0 && (
        <p className="text-center text-sm text-muted-foreground">You haven't created any publications yet.</p>
      )}
    </div>
  );
}
