'use client';

// Public Knowledge Portal landing page.
//
// Layout:
//   1. Hero with the African Union logo + central Google-style search bar
//   2. Browse-by-scope sections: Continental → RECs → Countries (each grouping
//      its own categories so the user can drill down geographically)
//   3. Latest published publications row

import { useState, useMemo, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, Folder, Globe2, Building2, Flag, ChevronRight, FileText, FolderTree, Eye } from 'lucide-react';
import {
  usePublicCategoryTree,
  useKnowledgeSearch,
  usePublicKnowledgeStats,
  pickLocale,
  type KnowledgeCategory,
} from '@/lib/api/knowledge-hub-hooks';

export default function PublicKnowledgePortalPage() {
  const router = useRouter();
  const [q, setQ] = useState('');

  const tree = usePublicCategoryTree();
  const stats = usePublicKnowledgeStats();
  // Latest 6 published items (search with empty query bypass via space)
  const featured = useKnowledgeSearch({ limit: 6, page: 1, q: ' ' });

  // Group root categories by scope
  const grouped = useMemo(() => {
    const continental: KnowledgeCategory[] = [];
    const recs: KnowledgeCategory[] = [];
    const countries: KnowledgeCategory[] = [];
    for (const cat of tree.data?.data ?? []) {
      if (cat.scope === 'CONTINENTAL') continental.push(cat);
      else if (cat.scope === 'REC') recs.push(cat);
      else if (cat.scope === 'COUNTRY') countries.push(cat);
    }
    return { continental, recs, countries };
  }, [tree.data]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/knowledge/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white dark:from-emerald-950 dark:via-gray-900 dark:to-gray-900">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-12 text-center">
        <div className="mx-auto flex max-w-3xl flex-col items-center">
          <Link href="/">
            <Image
              src="/au-logo.png"
              alt="African Union"
              width={96}
              height={96}
              className="mb-4 h-24 w-24 object-contain drop-shadow-md"
              priority
            />
          </Link>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white md:text-5xl">
            AU-IBAR Knowledge Hub
          </h1>
          <p className="mt-3 max-w-xl text-lg text-gray-600 dark:text-gray-300">
            Search policies, reports, news and technical resources from across the African Union
            and its 8 Regional Economic Communities.
          </p>

          <form onSubmit={onSubmit} className="mt-8 w-full max-w-2xl">
            <div className="flex items-center rounded-full border border-gray-300 bg-white px-5 py-3 shadow-lg transition-shadow focus-within:shadow-xl dark:border-gray-700 dark:bg-gray-800">
              <Search className="mr-3 h-5 w-5 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the knowledge base…"
                className="flex-1 bg-transparent text-base outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="ml-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Search
              </button>
            </div>
          </form>

          <div className="mt-3 text-xs text-gray-500">
            Try:{' '}
            <button onClick={() => router.push('/knowledge/search?q=outbreak')} className="underline hover:text-emerald-700">outbreak</button>{' · '}
            <button onClick={() => router.push('/knowledge/search?q=PVS')} className="underline hover:text-emerald-700">PVS</button>{' · '}
            <button onClick={() => router.push('/knowledge/search?q=transhumance')} className="underline hover:text-emerald-700">transhumance</button>
          </div>
        </div>
      </section>

      {/* ── Browse by scope ─────────────────────────────────── */}
      <section className="border-t bg-white px-6 py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl space-y-12">
          {/* Continental — header card + 3 KPI stats on one row */}
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Continental scope card */}
              <div
                className="flex items-center gap-3 rounded-xl border bg-white p-5 shadow-sm dark:bg-gray-800"
                style={{ borderTop: '3px solid #7c3aed' }}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: '#7c3aed20', color: '#7c3aed' }}>
                  <Globe2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold">Continental</h2>
                  <p className="text-xs text-muted-foreground">AU-IBAR publications & policy briefs</p>
                </div>
              </div>

              <StatCard
                icon={<FileText className="h-5 w-5" />}
                label="Publications"
                value={stats.data?.data?.publications}
                hint="Public publications across all scopes"
                accent="#7c3aed"
                loading={stats.isLoading}
              />
              <StatCard
                icon={<FolderTree className="h-5 w-5" />}
                label="Categories"
                value={stats.data?.data?.categories}
                hint="Active categories in the taxonomy"
                accent="#2563eb"
                loading={stats.isLoading}
              />
              <StatCard
                icon={<Eye className="h-5 w-5" />}
                label="Total views"
                value={stats.data?.data?.totalViews}
                hint="Cumulative reads across the knowledge base"
                accent="#16a34a"
                loading={stats.isLoading}
              />
            </div>

            {/* Continental categories */}
            {tree.isLoading ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-lg border bg-gray-100 dark:bg-gray-800" />
                ))}
              </div>
            ) : grouped.continental.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {grouped.continental.map((cat) => (
                  <CategoryRootCard key={cat.id} cat={cat} accent="#7c3aed" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No continental categories yet.</p>
            )}
          </div>

          {/* RECs */}
          <ScopeBlock
            icon={<Building2 className="h-5 w-5" />}
            label="Regional Economic Communities"
            tagline="Content published by ECOWAS, SADC, EAC, IGAD, ECCAS, UMA, COMESA, CEN-SAD"
            color="#2563eb"
            categories={grouped.recs}
            twoColumns
            loading={tree.isLoading}
          />

          {/* Countries */}
          <ScopeBlock
            icon={<Flag className="h-5 w-5" />}
            label="Member States"
            tagline="National publications and announcements from all 55 AU member states"
            color="#16a34a"
            categories={grouped.countries}
            twoColumns
            collapsed
            loading={tree.isLoading}
          />
        </div>
      </section>

      {/* ── Featured publications ───────────────────────────── */}
      {(featured.data?.data?.hits?.length ?? 0) > 0 && (
        <section className="border-t bg-emerald-50/60 px-6 py-12 dark:bg-gray-800/50">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-6 text-2xl font-bold">Latest publications</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featured.data!.data.hits.map((hit) => (
                <Link
                  key={hit.id}
                  href={`/knowledge/p/${hit.slug}`}
                  className="group rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800"
                >
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{hit.type}</span>
                  <h3 className="mt-2 font-semibold group-hover:text-emerald-700">{pickLocale(hit.title, 'en')}</h3>
                  {hit.summary && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">{pickLocale(hit.summary, 'en')}</p>
                  )}
                  {hit.publishedAt && (
                    <p className="mt-3 text-xs text-gray-400">{new Date(hit.publishedAt).toLocaleDateString()}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ScopeBlock({
  icon, label, tagline, color, categories, twoColumns, collapsed, loading,
}: {
  icon: React.ReactNode;
  label: string;
  tagline: string;
  color: string;
  categories: KnowledgeCategory[];
  twoColumns?: boolean;
  collapsed?: boolean;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(!collapsed);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <span className="rounded-lg p-2" style={{ backgroundColor: color + '20', color }}>
          {icon}
        </span>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{label}</h2>
          <p className="text-sm text-muted-foreground">{tagline}</p>
        </div>
        {collapsed && categories.length > 0 && (
          <button
            onClick={() => setOpen(!open)}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            {open ? 'Collapse' : `Show all ${categories.length}`}
          </button>
        )}
      </header>

      {loading ? (
        <div className={`grid gap-3 ${twoColumns ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
          {Array.from({ length: twoColumns ? 3 : 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : categories.length > 0 ? (
        open && (
          <div className={`grid gap-3 ${twoColumns ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
            {categories.map((cat) => (
              <CategoryRootCard key={cat.id} cat={cat} accent={color} />
            ))}
          </div>
        )
      ) : (
        <p className="text-sm text-muted-foreground italic">No categories available yet.</p>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  hint: string;
  accent: string;
  loading?: boolean;
}) {
  const formatted =
    value === undefined
      ? '—'
      : value >= 1000
      ? value.toLocaleString()
      : String(value);
  return (
    <div
      className="group relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
          <p
            className="mt-2 text-3xl font-bold tabular-nums text-gray-900 dark:text-white"
            aria-busy={loading}
          >
            {loading ? (
              <span className="inline-block h-8 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ) : (
              formatted
            )}
          </p>
          <p className="mt-1 text-xs text-gray-500">{hint}</p>
        </div>
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: accent + '15', color: accent }}
        >
          {icon}
        </span>
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-5 transition-opacity group-hover:opacity-10"
        style={{ backgroundColor: accent }}
      />
    </div>
  );
}

function CategoryRootCard({ cat, accent }: { cat: KnowledgeCategory; accent: string }) {
  const totalPubs = useMemo(() => {
    let n = cat.publicationCount ?? 0;
    const visit = (cs?: KnowledgeCategory[]) => {
      if (!cs) return;
      for (const c of cs) {
        n += c.publicationCount ?? 0;
        visit(c.children);
      }
    };
    visit(cat.children);
    return n;
  }, [cat]);

  return (
    <Link
      href={`/knowledge/c/${cat.slug}`}
      className="group flex items-start gap-3 rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <Folder className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
      <div className="flex-1 overflow-hidden">
        <div className="font-semibold group-hover:text-emerald-700">{cat.nameEn}</div>
        {(cat.children?.length ?? 0) > 0 && (
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {cat.children!.map((c) => c.nameEn).slice(0, 4).join(' · ')}
            {(cat.children!.length ?? 0) > 4 ? ' …' : ''}
          </div>
        )}
        <div className="mt-2 text-xs font-medium text-gray-400">{totalPubs} publication{totalPubs !== 1 ? 's' : ''}</div>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 text-gray-300 group-hover:text-emerald-600" />
    </Link>
  );
}
