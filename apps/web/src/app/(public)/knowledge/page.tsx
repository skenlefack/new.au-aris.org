'use client';

// Public Knowledge Portal — accessible without authentication.
// Google-style hero with central search bar + featured publications +
// browse-by-category grid. Linked from the continental login page via the
// "Knowledge Portal" quick-link card.

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, BookOpen, Folder } from 'lucide-react';
import { useKnowledgeSearch, usePublicCategoryTree, pickLocale } from '@/lib/api/knowledge-hub-hooks';

export default function PublicKnowledgePortalPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const tree = usePublicCategoryTree();
  // Featured = latest 6 published items
  const featured = useKnowledgeSearch({ limit: 6, page: 1, q: ' ' });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/knowledge/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950 dark:to-gray-900">
      {/* Hero */}
      <section className="px-6 pt-20 pb-16 text-center">
        <div className="mx-auto flex max-w-3xl flex-col items-center">
          <BookOpen className="mb-4 h-12 w-12 text-emerald-700" />
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white md:text-5xl">
            AU-IBAR Knowledge Hub
          </h1>
          <p className="mt-3 max-w-xl text-lg text-gray-600 dark:text-gray-300">
            Search policies, reports, news and technical resources from across the African Union.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 w-full max-w-2xl">
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

      {/* Browse by category */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-6 text-2xl font-bold">Browse by category</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(tree.data?.data ?? []).slice(0, 12).map((cat) => (
              <Link
                key={cat.id}
                href={`/knowledge/c/${cat.slug}`}
                className="group rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md p-2" style={{ backgroundColor: (cat.color ?? '#16a34a') + '20', color: cat.color ?? '#16a34a' }}>
                    <Folder className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold group-hover:text-emerald-700">{cat.nameEn}</h3>
                    <p className="mt-1 text-xs text-gray-500">{cat.scope}</p>
                    {cat.publicationCount !== undefined && (
                      <p className="mt-2 text-xs text-gray-400">{cat.publicationCount} publication(s)</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {(tree.data?.data?.length ?? 0) === 0 && (
            <p className="text-center text-sm text-gray-500">No categories yet — content is being prepared.</p>
          )}
        </div>
      </section>

      {/* Featured publications */}
      {(featured.data?.data?.hits?.length ?? 0) > 0 && (
        <section className="bg-white px-6 py-12 dark:bg-gray-900">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-6 text-2xl font-bold">Latest publications</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featured.data!.data.hits.map((hit) => (
                <Link
                  key={hit.id}
                  href={`/knowledge/p/${hit.slug}`}
                  className="group rounded-lg border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
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
