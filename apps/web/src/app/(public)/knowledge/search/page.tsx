'use client';

// Public search results page. Reads ?q= from the URL and renders OpenSearch
// hits with category, type, REC and country facets in a Google-style layout.

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  useKnowledgeSearch,
  useAllTenants,
  pickLocale,
  type PublicationType,
} from '@/lib/api/knowledge-hub-hooks';
import { PublicKnowledgeHeader } from '@/components/knowledge/PublicHeader';

function SearchResultsInner() {
  const params = useSearchParams();
  const initialQ = params.get('q') ?? '';
  const [page, setPage] = useState(1);
  const [type, setType] = useState<PublicationType | undefined>();
  const [recTenantId, setRecTenantId] = useState<string | undefined>();
  const [countryTenantId, setCountryTenantId] = useState<string | undefined>();

  // Reset filters when the query changes from the header search bar
  useEffect(() => {
    setPage(1);
  }, [initialQ]);

  const tenants = useAllTenants();
  const recs = useMemo(
    () => (tenants.data?.data ?? []).filter((t) => t.level === 'REC'),
    [tenants.data],
  );
  const countriesInRec = useMemo(() => {
    if (!recTenantId) return [];
    return (tenants.data?.data ?? []).filter(
      (t) => t.level === 'MEMBER_STATE' && t.parentId === recTenantId,
    );
  }, [tenants.data, recTenantId]);

  // The search service supports filtering by scopeTenantId — we feed it
  // either the country tenant id (most specific) or the REC tenant id.
  const scopeTenantId = countryTenantId ?? recTenantId;
  const scope = countryTenantId ? 'COUNTRY' : recTenantId ? 'REC' : undefined;

  const { data, isLoading } = useKnowledgeSearch({
    q: initialQ,
    type,
    scope,
    scopeTenantId,
    page,
    limit: 12,
  });

  const hits = data?.data?.hits ?? [];
  const facets = data?.data?.facets;
  const total = data?.data?.total ?? 0;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <PublicKnowledgeHeader initialQuery={initialQ} />

      <div className="mx-auto grid max-w-6xl grid-cols-12 gap-6 px-6 py-8">
        {/* ─── Facets sidebar ─────────────────────────────── */}
        <aside className="col-span-12 space-y-6 md:col-span-3">
          <FacetGroup label="Filter by REC">
            <select
              value={recTenantId ?? ''}
              onChange={(e) => {
                setRecTenantId(e.target.value || undefined);
                setCountryTenantId(undefined);
                setPage(1);
              }}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">All RECs</option>
              {recs.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </FacetGroup>

          <FacetGroup label="Filter by country">
            <select
              value={countryTenantId ?? ''}
              onChange={(e) => {
                setCountryTenantId(e.target.value || undefined);
                setPage(1);
              }}
              disabled={!recTenantId}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">{recTenantId ? 'All countries' : 'Pick a REC first'}</option>
              {countriesInRec.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FacetGroup>

          <FacetGroup label="Type">
            <ul className="space-y-1 text-sm">
              <li>
                <button
                  onClick={() => { setType(undefined); setPage(1); }}
                  className={`hover:underline ${!type ? 'font-semibold text-emerald-700' : ''}`}
                >
                  All types
                </button>
              </li>
              {(facets?.types ?? []).map((f) => (
                <li key={f.value}>
                  <button
                    onClick={() => { setType(f.value as PublicationType); setPage(1); }}
                    className={`hover:underline ${type === f.value ? 'font-semibold text-emerald-700' : ''}`}
                  >
                    {f.value} <span className="text-gray-400">({f.count})</span>
                  </button>
                </li>
              ))}
            </ul>
          </FacetGroup>

          {(recTenantId || countryTenantId || type) && (
            <button
              onClick={() => {
                setType(undefined);
                setRecTenantId(undefined);
                setCountryTenantId(undefined);
                setPage(1);
              }}
              className="text-xs text-gray-500 hover:text-emerald-700 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </aside>

        {/* ─── Results ─────────────────────────────────────── */}
        <section className="col-span-12 md:col-span-9">
          <p className="mb-4 text-xs text-gray-500">
            About {total} result{total !== 1 ? 's' : ''}{initialQ && <> for &quot;<strong>{initialQ}</strong>&quot;</>}
          </p>

          {isLoading ? (
            <p className="text-sm text-gray-500">Searching…</p>
          ) : hits.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center text-sm text-gray-500">
              No results. Try another keyword or remove some filters.
            </div>
          ) : (
            <ul className="space-y-6">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <Link href={`/knowledge/p/${hit.slug}`} className="group block">
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

          {total > 12 && (
            <div className="mt-8 flex flex-wrap gap-2">
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

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</h3>
      {children}
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
