'use client';

// Public Knowledge Portal landing page.
//
// Layout:
//   1. Hero with AU logo, title, search bar, popular tags
//   2. Value Chains grid — 7 AU-IBAR value chains as primary entry point
//   3. Browse by scope (Continental, RECs, Member States)
//   4. Right sidebar: Most viewed, Latest, Popular categories, Tags, Newsletter

import { useState, useMemo, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search, Folder, Building2, Flag, ChevronRight,
  TrendingUp, Clock, Tag, ArrowRight, Flame, BookOpen,
  HeartPulse, Beef, Fish, TreePine, Flower2, CloudSun,
} from 'lucide-react';
import {
  usePublicCategoryTree,
  useKnowledgeSearch,
  usePublicKnowledgeStats,
  usePublicPopularTags,
  pickLocale,
  type KnowledgeCategory,
} from '@/lib/api/knowledge-hub-hooks';

/** Map value-chain slugs to Lucide icons for the hero grid */
const VALUE_CHAIN_ICONS: Record<string, React.ReactNode> = {
  'animal-health':          <HeartPulse className="h-8 w-8" />,
  'livestock-production':   <Beef className="h-8 w-8" />,
  'fisheries-aquaculture':  <Fish className="h-8 w-8" />,
  'wildlife-biodiversity':  <TreePine className="h-8 w-8" />,
  'apiculture-pollination': <Flower2 className="h-8 w-8" />,
  'trade-markets':          <TrendingUp className="h-8 w-8" />,
  'climate-environment':    <CloudSun className="h-8 w-8" />,
};

const VALUE_CHAIN_SLUGS = new Set(Object.keys(VALUE_CHAIN_ICONS));

export default function PublicKnowledgePortalPage() {
  const router = useRouter();
  const [q, setQ] = useState('');

  const tree = usePublicCategoryTree();
  const stats = usePublicKnowledgeStats();
  const popularTags = usePublicPopularTags(12);
  const latest = useKnowledgeSearch({ limit: 5, page: 1, q: ' ' });
  const allHits = latest.data?.data?.hits ?? [];

  const mostViewed = useMemo(
    () => [...allHits].sort((a, b) => (b as any).viewCount - (a as any).viewCount).slice(0, 5),
    [allHits],
  );

  // Group root categories by scope — value chains are continental but displayed first
  const { continental, recs, countries } = useMemo(() => {
    const cont: KnowledgeCategory[] = [];
    const r: KnowledgeCategory[] = [];
    const c: KnowledgeCategory[] = [];
    for (const cat of tree.data?.data ?? []) {
      if (cat.scope === 'CONTINENTAL') cont.push(cat);
      else if (cat.scope === 'REC') r.push(cat);
      else if (cat.scope === 'COUNTRY') c.push(cat);
    }
    // Sort continental: value chains first (by sortOrder), then others
    cont.sort((a, b) => {
      const aIsVc = VALUE_CHAIN_SLUGS.has(a.slug) ? 0 : 1;
      const bIsVc = VALUE_CHAIN_SLUGS.has(b.slug) ? 0 : 1;
      if (aIsVc !== bIsVc) return aIsVc - bIsVc;
      return a.sortOrder - b.sortOrder;
    });
    return { continental: cont, recs: r, countries: c };
  }, [tree.data]);

  // Top categories by publication count
  const topCategories = useMemo(() => {
    const all = tree.data?.data ?? [];
    const withCount = all.map((cat) => {
      let n = cat.publicationCount ?? 0;
      const visit = (cs?: KnowledgeCategory[]) => {
        if (!cs) return;
        for (const c of cs) { n += c.publicationCount ?? 0; visit(c.children); }
      };
      visit(cat.children);
      return { ...cat, totalPubs: n };
    });
    return withCount.sort((a, b) => b.totalPubs - a.totalPubs).slice(0, 6);
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
                placeholder="Search the knowledge base..."
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

          {/* Inline stats — soft, under the search bar */}
          {!stats.isLoading && (
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              {[
                stats.data?.data?.publications != null && `${stats.data.data.publications} publications`,
                stats.data?.data?.categories != null && `${stats.data.data.categories} categories`,
                stats.data?.data?.contributingTenants != null && `${stats.data.data.contributingTenants} contributors`,
              ].filter(Boolean).join(' \u00B7 ')}
            </p>
          )}

          {(popularTags.data?.data?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs text-gray-500">
              <span>Popular:</span>
              {popularTags.data!.data.slice(0, 6).map((t) => (
                <button
                  key={t.tag}
                  onClick={() => router.push(`/knowledge/search?q=${encodeURIComponent(t.tag)}`)}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                >
                  {t.tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Main grid: Scope browse + Sidebar ─────────────── */}
      <section className="border-t bg-gray-50/50 px-6 py-12 dark:bg-gray-900/50">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_340px]">

          {/* ─── Left: Browse by scope ─────────────────────── */}
          <div className="space-y-12">
            {/* Continental — value chains + general categories */}
            <ScopeBlock
              icon={<BookOpen className="h-5 w-5" />}
              label="Continental Resources"
              tagline="AU-IBAR continental publications, policies and guidelines"
              color="#7c3aed"
              categories={continental}
              loading={tree.isLoading}
              useValueChainCards
            />

            {/* RECs — collapsed */}
            <ScopeBlock
              icon={<Building2 className="h-5 w-5" />}
              label="Regional Economic Communities"
              tagline="Content published by ECOWAS, SADC, EAC, IGAD, ECCAS, UMA, COMESA, CEN-SAD"
              color="#2563eb"
              categories={recs}
              twoColumns
              collapsed
              loading={tree.isLoading}
            />

            {/* Countries — collapsed */}
            <ScopeBlock
              icon={<Flag className="h-5 w-5" />}
              label="Member States"
              tagline="National publications and announcements from all 55 AU member states"
              color="#16a34a"
              categories={countries}
              twoColumns
              collapsed
              collapsedCount={55}
              loading={tree.isLoading}
            />
          </div>

          {/* ─── Right: Sidebar widgets ────────────────────── */}
          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">

            {/* Most viewed */}
            <SidebarWidget title="Most viewed" icon={<TrendingUp className="h-4 w-4" />} accent="#dc2626">
              {latest.isLoading ? (
                <WidgetSkeleton count={3} />
              ) : mostViewed.length > 0 ? (
                <ul className="space-y-3">
                  {mostViewed.map((hit, i) => (
                    <li key={hit.id}>
                      <Link href={`/knowledge/p/${hit.slug}`} className="group flex gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium group-hover:text-emerald-700">{pickLocale(hit.title, 'en')}</p>
                          <p className="text-xs text-gray-400">{hit.type}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs italic text-gray-400">No publications yet.</p>
              )}
            </SidebarWidget>

            {/* Latest publications */}
            <SidebarWidget title="Latest publications" icon={<Clock className="h-4 w-4" />} accent="#2563eb">
              {latest.isLoading ? (
                <WidgetSkeleton count={4} />
              ) : allHits.length > 0 ? (
                <ul className="space-y-3">
                  {allHits.slice(0, 5).map((hit) => (
                    <li key={hit.id}>
                      <Link href={`/knowledge/p/${hit.slug}`} className="group block">
                        <p className="truncate text-sm font-medium group-hover:text-emerald-700">{pickLocale(hit.title, 'en')}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">{hit.type}</span>
                          {hit.publishedAt && <span>{new Date(hit.publishedAt).toLocaleDateString()}</span>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs italic text-gray-400">No publications yet.</p>
              )}
              {allHits.length > 0 && (
                <Link href="/knowledge/search?q= " className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </SidebarWidget>

            {/* Popular categories */}
            <SidebarWidget title="Popular categories" icon={<Flame className="h-4 w-4" />} accent="#ea580c">
              {tree.isLoading ? (
                <WidgetSkeleton count={4} />
              ) : topCategories.length > 0 ? (
                <ul className="space-y-2">
                  {topCategories.map((cat) => (
                    <li key={cat.id}>
                      <Link
                        href={`/knowledge/c/${cat.slug}`}
                        className="group flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Folder className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                          <span className="truncate text-sm group-hover:text-emerald-700">{cat.nameEn}</span>
                        </div>
                        <span className="ml-2 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {cat.totalPubs}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs italic text-gray-400">No categories yet.</p>
              )}
            </SidebarWidget>

            {/* Tags cloud */}
            {(popularTags.data?.data?.length ?? 0) > 0 && (
              <SidebarWidget title="Tags" icon={<Tag className="h-4 w-4" />} accent="#7c3aed">
                <div className="flex flex-wrap gap-1.5">
                  {popularTags.data!.data.map((t) => (
                    <button
                      key={t.tag}
                      onClick={() => router.push(`/knowledge/search?q=${encodeURIComponent(t.tag)}`)}
                      className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-emerald-700"
                    >
                      {t.tag}
                      <span className="ml-1 text-gray-400">({t.count})</span>
                    </button>
                  ))}
                </div>
              </SidebarWidget>
            )}

          </aside>
        </div>
      </section>
    </div>
  );
}

// ─── Value Chain Card ───────────────────────────────────────────────────────

function ValueChainCard({ cat }: { cat: KnowledgeCategory }) {
  const totalPubs = useMemo(() => {
    let n = cat.publicationCount ?? 0;
    const visit = (cs?: KnowledgeCategory[]) => {
      if (!cs) return;
      for (const c of cs) { n += c.publicationCount ?? 0; visit(c.children); }
    };
    visit(cat.children);
    return n;
  }, [cat]);

  const icon = VALUE_CHAIN_ICONS[cat.slug];
  const color = cat.color ?? '#16a34a';

  return (
    <Link
      href={`/knowledge/c/${cat.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:bg-gray-800"
      style={{ borderTop: `4px solid ${color}` }}
    >
      <div className="flex flex-1 flex-col p-4">
        {/* Icon + badge */}
        <div className="mb-3 flex items-start justify-between">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: color + '15', color }}
          >
            {icon ?? <Folder className="h-7 w-7" />}
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {totalPubs} doc{totalPubs !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
          {cat.nameEn}
        </h3>
        {cat.nameFr && cat.nameFr !== cat.nameEn && (
          <p className="mt-0.5 text-xs text-gray-400">{cat.nameFr}</p>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-4 py-2.5 text-xs font-medium"
        style={{ backgroundColor: color + '08', color }}
      >
        <span>Explore resources</span>
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

// ─── Reusable components ─────────────────────────────────────────────────────

function SidebarWidget({ title, icon, accent, children }: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-gray-800">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: accent + '15', color: accent }}>
          {icon}
        </span>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function WidgetSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-gray-100 dark:bg-gray-700" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ScopeBlock({
  icon, label, tagline, color, categories, twoColumns, collapsed, collapsedCount, loading, useValueChainCards,
}: {
  icon: React.ReactNode;
  label: string;
  tagline: string;
  color: string;
  categories: KnowledgeCategory[];
  twoColumns?: boolean;
  collapsed?: boolean;
  collapsedCount?: number;
  loading?: boolean;
  useValueChainCards?: boolean;
}) {
  const [open, setOpen] = useState(!collapsed);

  // No separation needed — all continental categories use the same card style
  const _ = useValueChainCards; // consumed for type-checking
  const displayCount = collapsedCount ?? categories.length;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <span className="rounded-lg p-2" style={{ backgroundColor: color + '20', color }}>
          {icon}
        </span>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{label}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{tagline}</p>
        </div>
        {collapsed && categories.length > 0 && (
          <button
            onClick={() => setOpen(!open)}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-white dark:hover:bg-gray-800"
          >
            {open ? 'Collapse' : `Show all ${displayCount}`}
          </button>
        )}
      </header>

      {loading ? (
        <div className={`grid gap-3 ${useValueChainCards ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : twoColumns ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
          {Array.from({ length: useValueChainCards ? 7 : twoColumns ? 2 : 3 }).map((_, i) => (
            <div key={i} className={`animate-pulse rounded-lg border bg-gray-100 dark:bg-gray-800 ${useValueChainCards ? 'h-44 rounded-2xl' : 'h-24'}`} />
          ))}
        </div>
      ) : categories.length > 0 ? (
        (!collapsed || open) && (
          useValueChainCards ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.map((cat) => (
                <ValueChainCard key={cat.id} cat={cat} />
              ))}
            </div>
          ) : (
            <div className={`grid gap-3 ${twoColumns ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
              {categories.map((cat) => (
                <CategoryRootCard key={cat.id} cat={cat} accent={color} />
              ))}
            </div>
          )
        )
      ) : (
        <p className="text-sm italic text-gray-400">No categories available yet.</p>
      )}
    </div>
  );
}

function CategoryRootCard({ cat, accent }: { cat: KnowledgeCategory; accent: string }) {
  const totalPubs = useMemo(() => {
    let n = cat.publicationCount ?? 0;
    const visit = (cs?: KnowledgeCategory[]) => {
      if (!cs) return;
      for (const c of cs) { n += c.publicationCount ?? 0; visit(c.children); }
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
          <div className="mt-1 truncate text-xs text-gray-400">
            {cat.children!.map((c) => c.nameEn).slice(0, 4).join(' \u00B7 ')}
            {(cat.children!.length ?? 0) > 4 ? ' \u2026' : ''}
          </div>
        )}
        <div className="mt-2 text-xs font-medium text-gray-400">{totalPubs} publication{totalPubs !== 1 ? 's' : ''}</div>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 text-gray-300 group-hover:text-emerald-600" />
    </Link>
  );
}
