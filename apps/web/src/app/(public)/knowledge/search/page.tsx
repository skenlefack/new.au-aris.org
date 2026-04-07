'use client';

// Public search results page. Reads ?q= from the URL and renders OpenSearch
// hits with category and type facets in a Google-style results layout.

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useKnowledgeSearch, pickLocale, type PublicationType } from '@/lib/api/knowledge-hub-hooks';

function SearchResultsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initialQ = params.get('q') ?? '';
  const [q, setQ] = useState(initialQ);
  const [type, setType] = useState<PublicationType | undefined>();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setQ(initialQ);
    setPage(1);
  }, [initialQ]);

  const { data, isLoading } = useKnowledgeSearch({ q: initialQ, type, page, limit: 12 });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/knowledge/search?q=${encodeURIComponent(q.trim())}`);
  };

  const hits = data?.data?.hits ?? [];
  const facets = data?.data?.facets;
  const total = data?.data?.total ?? 0;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <header className="border-b bg-emerald-50 px-6 py-4 dark:bg-gray-800">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/knowledge" className="text-lg font-bold text-emerald-700">AU-IBAR KH</Link>
          <form onSubmit={submit} className="flex-1">
            <div className="flex items-center rounded-full border border-gray-300 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-700">
              <Search className="mr-2 h-4 w-4 text-gray-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" />
            </div>
          </form>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-12 gap-6 px-6 py-8">
        {/* Facets */}
        <aside className="col-span-3">
          <h3 className="mb-2 text-sm font-semibold">Type</h3>
          <ul className="space-y-1 text-sm">
            <li>
              <button onClick={() => setType(undefined)} className={`hover:underline ${!type ? 'font-medium text-emerald-700' : ''}`}>
                All
              </button>
            </li>
            {facets?.types.map((f) => (
              <li key={f.value}>
                <button
                  onClick={() => setType(f.value as PublicationType)}
                  className={`hover:underline ${type === f.value ? 'font-medium text-emerald-700' : ''}`}
                >
                  {f.value} ({f.count})
                </button>
              </li>
            ))}
          </ul>

          {(facets?.scopes?.length ?? 0) > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold">Scope</h3>
              <ul className="space-y-1 text-sm">
                {facets!.scopes.map((f) => (
                  <li key={f.value}>{f.value} ({f.count})</li>
                ))}
              </ul>
            </>
          )}
        </aside>

        {/* Results */}
        <section className="col-span-9">
          <p className="mb-4 text-xs text-gray-500">
            About {total} result{total !== 1 ? 's' : ''} for "{initialQ}"
          </p>

          {isLoading ? (
            <p className="text-sm text-gray-500">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="text-sm text-gray-500">No results. Try another keyword.</p>
          ) : (
            <ul className="space-y-6">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <Link href={`/knowledge/p/${hit.slug}`} className="group">
                    <p className="text-xs text-gray-500">/{hit.scope?.toLowerCase()} · {hit.type}</p>
                    <h2 className="text-lg font-medium text-blue-700 group-hover:underline">
                      {pickLocale(hit.title, 'en')}
                    </h2>
                    {hit.highlight ? (
                      <p
                        className="mt-1 text-sm text-gray-600"
                        dangerouslySetInnerHTML={{ __html: hit.highlight }}
                      />
                    ) : hit.summary ? (
                      <p className="mt-1 text-sm text-gray-600">{pickLocale(hit.summary, 'en')}</p>
                    ) : null}
                    {hit.tags.length > 0 && (
                      <div className="mt-2 flex gap-1.5">
                        {hit.tags.slice(0, 5).map((t) => (
                          <span key={t} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{t}</span>
                        ))}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          {total > 12 && (
            <div className="mt-8 flex gap-2">
              {Array.from({ length: Math.ceil(total / 12) }).slice(0, 10).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`rounded px-3 py-1 text-sm ${page === i + 1 ? 'bg-emerald-600 text-white' : 'border'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-gray-500">Loading…</div>}>
      <SearchResultsInner />
    </Suspense>
  );
}
