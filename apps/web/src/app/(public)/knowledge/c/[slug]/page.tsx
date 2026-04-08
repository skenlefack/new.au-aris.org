'use client';

// Public category landing page — lists all PUBLISHED + PUBLIC publications
// in the given category. Shows the persistent search header at the top so
// visitors can keep searching while browsing the taxonomy, plus the
// sub-category breakdown for the current node.

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import Link from 'next/link';
import { Folder, ChevronRight } from 'lucide-react';
import { knowledgeHubClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import {
  useKnowledgeSearch,
  usePublicCategoryTree,
  pickLocale,
  type KnowledgeCategory,
} from '@/lib/api/knowledge-hub-hooks';
import { PublicKnowledgeHeader } from '@/components/knowledge/PublicHeader';
import { KnowledgeBreadcrumb, type BreadcrumbItem } from '@/components/knowledge/KnowledgeBreadcrumb';

export default function PublicCategoryPage() {
  const { slug } = useParams<{ slug: string }>();

  const cat = useQuery({
    queryKey: ['knowledge', 'public-category', slug],
    queryFn: () =>
      knowledgeHubClient.get<{ data: KnowledgeCategory }>(
        `/knowledge/categories/public/by-slug/${slug}`,
      ),
    enabled: !!slug,
  });

  const tree = usePublicCategoryTree();

  // Find this category in the tree + walk up to assemble the ancestor chain
  const { subcategories, ancestors } = useMemo(() => {
    if (!cat.data?.data) return { subcategories: [], ancestors: [] as KnowledgeCategory[] };
    const targetId = cat.data.data.id;
    // DFS that returns the path from a root down to the target
    const findPath = (
      cats: KnowledgeCategory[] | undefined,
      id: string,
      trail: KnowledgeCategory[] = [],
    ): KnowledgeCategory[] | null => {
      if (!cats) return null;
      for (const c of cats) {
        const next = [...trail, c];
        if (c.id === id) return next;
        const found = findPath(c.children, id, next);
        if (found) return found;
      }
      return null;
    };
    const path = findPath(tree.data?.data, targetId) ?? [cat.data.data];
    const node = path[path.length - 1];
    return { subcategories: node.children ?? [], ancestors: path };
  }, [cat.data, tree.data]);

  const breadcrumbItems: BreadcrumbItem[] = ancestors.map((c, i) => ({
    label: c.nameEn,
    href: i === ancestors.length - 1 ? undefined : `/knowledge/c/${c.slug}`,
  }));

  const list = useKnowledgeSearch({
    categoryId: cat.data?.data?.id,
    limit: 24,
  });

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <PublicKnowledgeHeader context={cat.data?.data?.nameEn} />

      <div className="mx-auto max-w-6xl px-6 py-8">
        <KnowledgeBreadcrumb items={breadcrumbItems} className="mb-4" />

        {/* Title block */}
        {cat.data && (
          <header className="mb-8">
            <div className="flex items-center gap-3">
              <span
                className="rounded-lg p-2"
                style={{
                  backgroundColor: (cat.data.data.color ?? '#16a34a') + '20',
                  color: cat.data.data.color ?? '#16a34a',
                }}
              >
                <Folder className="h-5 w-5" />
              </span>
              <h1 className="text-3xl font-bold">{cat.data.data.nameEn}</h1>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{cat.data.data.scope}</span>
            </div>
            {cat.data.data.descriptionEn && (
              <p className="mt-3 max-w-3xl text-gray-600 dark:text-gray-300">{cat.data.data.descriptionEn}</p>
            )}
          </header>
        )}

        {/* Sub-categories quick-jump */}
        {subcategories.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Sub-categories
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/knowledge/c/${sub.slug}`}
                  className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-shadow hover:shadow-md"
                >
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium group-hover:text-emerald-700">{sub.nameEn}</div>
                    {sub.publicationCount !== undefined && sub.publicationCount > 0 && (
                      <div className="text-xs text-muted-foreground">{sub.publicationCount} publication{sub.publicationCount !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-600" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Publications */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Publications
          </h2>
          {list.isLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (list.data?.data?.hits?.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center text-sm text-gray-500">
              No publications in this category yet.
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {list.data!.data.hits.map((hit) => (
                <li key={hit.id}>
                  <Link
                    href={`/knowledge/p/${hit.slug}`}
                    className="block rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800"
                  >
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {hit.type}
                    </span>
                    <h3 className="mt-2 font-semibold">{pickLocale(hit.title, 'en')}</h3>
                    {hit.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">{pickLocale(hit.summary, 'en')}</p>
                    )}
                    {hit.publishedAt && (
                      <p className="mt-3 text-xs text-gray-400">
                        {new Date(hit.publishedAt).toLocaleDateString()}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
