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
import { Search, Folder, Globe2, Building2, Flag, ChevronRight } from 'lucide-react';
import {
  usePublicCategoryTree,
  useKnowledgeSearch,
  pickLocale,
  type KnowledgeCategory,
} from '@/lib/api/knowledge-hub-hooks';

export default function PublicKnowledgePortalPage() {
  const router = useRouter();
  const [q, setQ] = useState('');

  const tree = usePublicCategoryTree();
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
          <Image
            src="/au-logo.png"
            alt="African Union"
            width={96}
            height={96}
            className="mb-4 h-24 w-24 object-contain drop-shadow-md"
            priority
          />
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white md:text-5xl">
            AU-IBAR Knowledge Hub
          </h1>
          <p className="mt-3 max-w-xl text-lg text-gray-600 dark:text-gray-300">
            Search policies, reports, news and technical resources from across the African Union
            and its 8 Regional Economic Communities.
          </p>

          <form onSubmit={onSubmit} className="mt-8 w-full max-w-2xl">
            <div className="flex items-center rounded-full border border-gray-300 bg-white px-5 py-3 shadow-lg focus-within:border-emerald-500 dark:border-gray-700 dark:bg-gray-800">
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
          {/* Continental */}
          <ScopeBlock
            icon={<Globe2 className="h-5 w-5" />}
            label="Continental"
            tagline="AU-IBAR continental publications and policy briefs"
            color="#7c3aed"
            categories={grouped.continental}
          />

          {/* RECs */}
          <ScopeBlock
            icon={<Building2 className="h-5 w-5" />}
            label="Regional Economic Communities"
            tagline="Content published by ECOWAS, SADC, EAC, IGAD, ECCAS, UMA, COMESA, CEN-SAD"
            color="#2563eb"
            categories={grouped.recs}
            twoColumns
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
  icon, label, tagline, color, categories, twoColumns, collapsed,
}: {
  icon: React.ReactNode;
  label: string;
  tagline: string;
  color: string;
  categories: KnowledgeCategory[];
  twoColumns?: boolean;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(!collapsed);

  if (categories.length === 0) return null;

  return (
    <div>
      <header className="mb-4 flex items-center gap-3">
        <span className="rounded-lg p-2" style={{ backgroundColor: color + '20', color }}>
          {icon}
        </span>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{label}</h2>
          <p className="text-sm text-muted-foreground">{tagline}</p>
        </div>
        {collapsed && (
          <button
            onClick={() => setOpen(!open)}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            {open ? 'Collapse' : `Show all ${categories.length}`}
          </button>
        )}
      </header>
      {open && (
        <div className={`grid gap-3 ${twoColumns ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
          {categories.map((cat) => (
            <CategoryRootCard key={cat.id} cat={cat} accent={color} />
          ))}
        </div>
      )}
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
