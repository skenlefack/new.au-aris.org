'use client';

// Public category landing page — lists all PUBLISHED + PUBLIC publications
// in the given category (by slug). No authentication required.

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { knowledgeHubClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { useKnowledgeSearch, pickLocale, type KnowledgeCategory } from '@/lib/api/knowledge-hub-hooks';

export default function PublicCategoryPage() {
  const { slug } = useParams<{ slug: string }>();

  const cat = useQuery({
    queryKey: ['knowledge', 'public-category', slug],
    queryFn: () =>
      knowledgeHubClient.get<{ data: KnowledgeCategory }>(`/knowledge/categories/public/by-slug/${slug}`),
    enabled: !!slug,
  });

  const list = useKnowledgeSearch({
    categoryId: cat.data?.data?.id,
    limit: 24,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/knowledge" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-700">
        <ArrowLeft className="h-4 w-4" /> Knowledge Hub
      </Link>

      {cat.data && (
        <header className="mt-4">
          <h1 className="text-3xl font-bold">{cat.data.data.nameEn}</h1>
          <p className="mt-1 text-sm text-gray-500">{cat.data.data.scope}</p>
          {cat.data.data.descriptionEn && (
            <p className="mt-3 text-gray-600 dark:text-gray-300">{cat.data.data.descriptionEn}</p>
          )}
        </header>
      )}

      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {(list.data?.data?.hits ?? []).map((hit) => (
          <li key={hit.id}>
            <Link
              href={`/knowledge/p/${hit.slug}`}
              className="block rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800"
            >
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{hit.type}</span>
              <h3 className="mt-2 font-semibold">{pickLocale(hit.title, 'en')}</h3>
              {hit.summary && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-500">{pickLocale(hit.summary, 'en')}</p>
              )}
              {hit.publishedAt && (
                <p className="mt-3 text-xs text-gray-400">{new Date(hit.publishedAt).toLocaleDateString()}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {(list.data?.data?.hits?.length ?? 0) === 0 && (
        <p className="mt-12 text-center text-sm text-gray-500">No publications in this category yet.</p>
      )}
    </div>
  );
}
