'use client';

// Knowledge Management System — dashboard home for authenticated users.
//
// Visual hierarchy:
//   1. Header with hero stats and primary actions
//   2. Three KPI cards + a "review needed" highlight (only for managers)
//   3. Two-column body: latest published (left) + my publications (right)
//   4. Workflow widgets: pending category proposals + reviewer queue (managers)
//   5. Quick links footer (categories, public portal, my drafts)

import Link from 'next/link';
import {
  FileText,
  ClipboardCheck,
  Plus,
  ExternalLink,
  FolderTree,
  Sparkles,
  BookOpenCheck,
  Globe2,
  ArrowRight,
  Clock,
} from 'lucide-react';
import {
  usePublications,
  useReviewQueue,
  useCategoryReviewQueue,
  useCategoryTree,
  pickLocale,
} from '@/lib/api/knowledge-hub-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';

const REVIEWER_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'KNOWLEDGE_MANAGER']);

export default function KnowledgeDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const locale = useAuthStore((s) => s.user?.locale ?? 'en');
  const isReviewer = !!user?.roles?.some((r) => REVIEWER_ROLES.has(r));

  const myPubs = usePublications({ mine: true, limit: 5 });
  const allPublished = usePublications({ status: 'PUBLISHED', limit: 6 });
  const queue = useReviewQueue();
  const catQueue = useCategoryReviewQueue();
  const tree = useCategoryTree({ withCounts: true });

  // ── Aggregate counts from the (already-fetched) category tree ──────────
  const categoryStats = (() => {
    let total = 0, continental = 0, rec = 0, country = 0;
    const visit = (cats: any[]) => {
      for (const c of cats) {
        total++;
        if (c.scope === 'CONTINENTAL') continental++;
        else if (c.scope === 'REC') rec++;
        else if (c.scope === 'COUNTRY') country++;
        if (c.children?.length) visit(c.children);
      }
    };
    visit(tree.data?.data ?? []);
    return { total, continental, rec, country };
  })();

  return (
    <div className="space-y-8 p-6">
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 p-8 text-white shadow-lg">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3 w-3" /> Knowledge Management
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Welcome{user?.firstName ? `, ${user.firstName}` : ''}
            </h1>
            <p className="mt-2 max-w-xl text-emerald-100">
              Publish and validate institutional knowledge across the African Union — articles,
              reports, briefings, news and more. Multilingual content (EN/FR/PT/AR) with
              workflow validation by the continental knowledge manager.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <Link
              href="/knowledge/admin/publications/new"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow hover:bg-emerald-50"
            >
              <Plus className="h-4 w-4" /> New publication
            </Link>
            <Link
              href="/knowledge"
              target="_blank"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              <ExternalLink className="h-4 w-4" /> Public portal
            </Link>
          </div>
        </div>
      </section>

      {/* ─── KPI strip ────────────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          color="emerald"
          icon={<BookOpenCheck className="h-5 w-5" />}
          label="Published content"
          value={allPublished.data?.meta?.total ?? 0}
          subtitle="Visible on the portal"
        />
        <KpiCard
          color="blue"
          icon={<FileText className="h-5 w-5" />}
          label="My publications"
          value={myPubs.data?.meta?.total ?? 0}
          subtitle="Drafts + submitted + published"
          link="/knowledge/admin/mine"
        />
        <KpiCard
          color="purple"
          icon={<FolderTree className="h-5 w-5" />}
          label="Categories"
          value={categoryStats.total}
          subtitle={`${categoryStats.continental} cont · ${categoryStats.rec} REC · ${categoryStats.country} country`}
          link="/knowledge/admin/categories"
        />
        {isReviewer ? (
          <KpiCard
            color="orange"
            highlight={(queue.data?.data?.length ?? 0) > 0}
            icon={<ClipboardCheck className="h-5 w-5" />}
            label="Awaiting review"
            value={(queue.data?.data?.length ?? 0) + (catQueue.data?.data?.length ?? 0)}
            subtitle={`${queue.data?.data?.length ?? 0} content · ${catQueue.data?.data?.length ?? 0} category`}
            link="/knowledge/admin/review"
          />
        ) : (
          <KpiCard
            color="rose"
            icon={<Globe2 className="h-5 w-5" />}
            label="Tenant scope"
            value={user?.tenantLevel ?? '—'}
            subtitle="Your publishing rights"
          />
        )}
      </section>

      {/* ─── Two-column body ─────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Latest published (left, 2 cols) */}
        <section className="rounded-xl border bg-card lg:col-span-2">
          <header className="flex items-center justify-between border-b p-5">
            <div>
              <h2 className="text-base font-semibold">Latest published</h2>
              <p className="text-xs text-muted-foreground">Recently approved content visible on the public portal</p>
            </div>
            <Link href="/knowledge" target="_blank" className="text-sm text-primary hover:underline">
              View all →
            </Link>
          </header>
          {(allPublished.data?.data?.length ?? 0) === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No published content yet.</p>
          ) : (
            <ul className="divide-y">
              {allPublished.data!.data.slice(0, 6).map((pub) => (
                <li key={pub.id} className="p-5 transition-colors hover:bg-accent/40">
                  <Link href={`/knowledge/p/${pub.slug}`} target="_blank" className="block">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700">{pub.type}</span>
                      {pub.category && <span>· {pub.category.nameEn}</span>}
                      {pub.publishedAt && <span>· {new Date(pub.publishedAt).toLocaleDateString()}</span>}
                    </div>
                    <h3 className="mt-1 font-medium hover:text-primary">{pickLocale(pub.title, locale) || pub.slug}</h3>
                    {pub.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {pickLocale(pub.summary, locale)}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Right column: my publications */}
        <section className="rounded-xl border bg-card">
          <header className="flex items-center justify-between border-b p-5">
            <h2 className="text-base font-semibold">My publications</h2>
            <Link href="/knowledge/admin/mine" className="text-sm text-primary hover:underline">
              All →
            </Link>
          </header>
          {myPubs.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading…</p>
          ) : (myPubs.data?.data?.length ?? 0) === 0 ? (
            <div className="p-8 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">You haven't created any publications yet.</p>
              <Link
                href="/knowledge/admin/publications/new"
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3 w-3" /> Create your first
              </Link>
            </div>
          ) : (
            <ul className="divide-y">
              {myPubs.data!.data.slice(0, 6).map((pub) => (
                <li key={pub.id} className="p-4">
                  <Link href={`/knowledge/admin/publications/${pub.id}`} className="block hover:text-primary">
                    <div className="font-medium text-sm">{pickLocale(pub.title, locale) || pub.slug}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {pub.type} · {new Date(pub.updatedAt).toLocaleDateString()}
                      </span>
                      <StatusBadge status={pub.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ─── Reviewer workflow widgets ─────────────────────── */}
      {isReviewer && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pending publications */}
          <section className="rounded-xl border bg-card">
            <header className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <ClipboardCheck className="h-4 w-4 text-orange-600" /> Content review queue
                </h2>
                <p className="text-xs text-muted-foreground">{queue.data?.data?.length ?? 0} item(s) awaiting validation</p>
              </div>
              <Link href="/knowledge/admin/review" className="text-sm text-primary hover:underline">
                Open queue →
              </Link>
            </header>
            {(queue.data?.data?.length ?? 0) === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">All caught up 🎉</p>
            ) : (
              <ul className="divide-y">
                {queue.data!.data.slice(0, 4).map((pub) => (
                  <li key={pub.id} className="p-4">
                    <Link href={`/knowledge/admin/review/${pub.id}`} className="flex items-center justify-between hover:text-primary">
                      <div>
                        <div className="font-medium text-sm">{pickLocale(pub.title, locale) || pub.slug}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {pub.type} · {pub.category?.nameEn} ·{' '}
                          {pub.submittedAt && new Date(pub.submittedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Pending categories */}
          <section className="rounded-xl border bg-card">
            <header className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <FolderTree className="h-4 w-4 text-purple-600" /> Category proposals
                </h2>
                <p className="text-xs text-muted-foreground">{catQueue.data?.data?.length ?? 0} category(ies) proposed by REC/country users</p>
              </div>
              <Link href="/knowledge/admin/categories/review" className="text-sm text-primary hover:underline">
                Open queue →
              </Link>
            </header>
            {(catQueue.data?.data?.length ?? 0) === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No pending proposals</p>
            ) : (
              <ul className="divide-y">
                {catQueue.data!.data.slice(0, 4).map((cat) => (
                  <li key={cat.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{cat.nameEn}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded bg-muted px-1.5 py-0.5">{cat.scope}</span>
                          {cat.submittedAt && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(cat.submittedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <Link
                        href="/knowledge/admin/categories/review"
                        className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      >
                        Review
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ─── Quick links footer ──────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-3">
        <QuickLink
          icon={<FolderTree className="h-5 w-5 text-purple-600" />}
          title="Manage categories"
          desc="Browse the taxonomy or propose new categories for your level."
          href="/knowledge/admin/categories"
        />
        <QuickLink
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          title="My publications"
          desc="Drafts, in-review, approved — track everything you've written."
          href="/knowledge/admin/mine"
        />
        <QuickLink
          icon={<Globe2 className="h-5 w-5 text-emerald-600" />}
          title="Public portal"
          desc="Open the public Knowledge Hub in a new tab."
          href="/knowledge"
          external
        />
      </section>
    </div>
  );
}

function KpiCard({
  icon, label, value, subtitle, color, highlight, link,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtitle?: string;
  color: 'emerald' | 'blue' | 'purple' | 'orange' | 'rose';
  highlight?: boolean;
  link?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  };
  const inner = (
    <div className={`group rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md ${highlight ? 'ring-2 ring-orange-300' : ''}`}>
      <div className="flex items-start justify-between">
        <span className={`rounded-lg border p-2 ${colorMap[color]}`}>{icon}</span>
        {link && <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
      <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
  return link ? <Link href={link}>{inner}</Link> : inner;
}

function QuickLink({ icon, title, desc, href, external }: { icon: React.ReactNode; title: string; desc: string; href: string; external?: boolean }) {
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      className="group flex items-start gap-3 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
    >
      <div className="rounded-lg bg-muted p-2">{icon}</div>
      <div className="flex-1">
        <h3 className="font-semibold group-hover:text-primary">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
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
