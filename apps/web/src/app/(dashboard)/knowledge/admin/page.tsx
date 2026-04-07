'use client';

// Knowledge Management System — dashboard home for authenticated users.
//
// Shows: aggregate KPIs, the publications the user has authored, the
// reviewer queue (if user is KNOWLEDGE_MANAGER), and quick links to the
// public portal and admin pages.

import Link from 'next/link';
import { BookOpen, FileText, ClipboardCheck, Plus, Search, FolderTree } from 'lucide-react';
import { usePublications, useReviewQueue, pickLocale } from '@/lib/api/knowledge-hub-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';

const REVIEWER_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'KNOWLEDGE_MANAGER']);

export default function KnowledgePortalPage() {
  const t = useTranslations('knowledge');
  const user = useAuthStore((s) => s.user);
  const locale = useAuthStore((s) => s.user?.locale ?? 'en');
  const isReviewer = !!user?.roles?.some((r) => REVIEWER_ROLES.has(r));

  const myPubs = usePublications({ mine: true, limit: 5 });
  const queue = useReviewQueue();
  const allPublished = usePublications({ status: 'PUBLISHED', limit: 6 });

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title') ?? 'Knowledge Hub'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('subtitle') ?? 'Publish, validate and discover institutional knowledge across the African Union.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/knowledge/admin/publications/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {t('newPublication') ?? 'New publication'}
          </Link>
          <Link
            href="/knowledge"
            className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
            target="_blank"
          >
            <Search className="h-4 w-4" /> {t('publicPortal') ?? 'Public portal'}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi icon={<FileText className="h-5 w-5" />} label={t('myDrafts') ?? 'My publications'} value={myPubs.data?.meta?.total ?? 0} />
        <Kpi icon={<BookOpen className="h-5 w-5" />} label={t('publishedTotal') ?? 'Published'} value={allPublished.data?.meta?.total ?? 0} />
        {isReviewer && (
          <Kpi
            icon={<ClipboardCheck className="h-5 w-5" />}
            label={t('reviewQueue') ?? 'Awaiting review'}
            value={queue.data?.data?.length ?? 0}
            highlight
            link="/knowledge/admin/review"
          />
        )}
        <Kpi icon={<FolderTree className="h-5 w-5" />} label={t('quickAccess') ?? 'Browse'} value="A→Z" link="/knowledge/admin/categories" />
      </div>

      {isReviewer && (queue.data?.data?.length ?? 0) > 0 && (
        <section className="rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('reviewQueue') ?? 'Review queue'}</h2>
            <Link href="/knowledge/admin/review" className="text-sm text-primary hover:underline">
              {t('viewAll') ?? 'View all'} →
            </Link>
          </div>
          <ul className="divide-y">
            {queue.data!.data.slice(0, 5).map((pub) => (
              <li key={pub.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/knowledge/admin/review/${pub.id}`} className="font-medium hover:underline">
                    {pickLocale(pub.title, locale) || pub.slug}
                  </Link>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {pub.type} · {pub.category?.nameEn} · {pub.submittedAt && new Date(pub.submittedAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  {pub.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('myPublications') ?? 'My publications'}</h2>
          <Link href="/knowledge/admin/mine" className="text-sm text-primary hover:underline">
            {t('viewAll') ?? 'View all'} →
          </Link>
        </div>
        {myPubs.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('loading') ?? 'Loading…'}</p>
        ) : (myPubs.data?.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noPublications') ?? "You haven't created any publications yet."}</p>
        ) : (
          <ul className="divide-y">
            {myPubs.data!.data.map((pub) => (
              <li key={pub.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/knowledge/admin/publications/${pub.id}`} className="font-medium hover:underline">
                    {pickLocale(pub.title, locale) || pub.slug}
                  </Link>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {pub.type} · {pub.category?.nameEn ?? '—'} · {new Date(pub.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <StatusBadge status={pub.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon, label, value, highlight, link }: { icon: React.ReactNode; label: string; value: number | string; highlight?: boolean; link?: string }) {
  const inner = (
    <div className={`rounded-lg border bg-card p-5 ${highlight ? 'ring-2 ring-orange-200' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="rounded bg-muted p-2">{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-bold">{value}</div>
    </div>
  );
  return link ? <Link href={link}>{inner}</Link> : inner;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SUBMITTED: 'bg-blue-100 text-blue-700',
    UNDER_REVIEW: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
    PUBLISHED: 'bg-green-100 text-green-700',
    ARCHIVED: 'bg-slate-100 text-slate-600',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? 'bg-gray-100'}`}>{status}</span>;
}
