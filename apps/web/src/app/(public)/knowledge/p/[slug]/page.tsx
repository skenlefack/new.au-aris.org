'use client';

// Public publication detail page (no authentication required).
// Renders the TinyMCE-authored HTML with a locale switcher and lists
// downloadable attachments via the drive-service.

import { useParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { usePublicPublication, pickLocale } from '@/lib/api/knowledge-hub-hooks';

const LOCALES = ['en', 'fr', 'pt', 'ar'] as const;

export default function PublicPublicationPage() {
  const { slug } = useParams<{ slug: string }>();
  const [locale, setLocale] = useState<(typeof LOCALES)[number]>('en');
  const { data, isLoading, error } = usePublicPublication(slug);

  if (isLoading) return <div className="p-12 text-center text-sm text-gray-500">Loading…</div>;
  if (error || !data?.data) return <div className="p-12 text-center text-sm text-red-600">Publication not found.</div>;

  const pub = data.data;
  const availableLocales = LOCALES.filter((l) => pub.title?.[l] || pub.contentHtml?.[l]);

  return (
    <article className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/knowledge" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-700">
        <ArrowLeft className="h-4 w-4" /> Back to Knowledge Hub
      </Link>

      <header className="mt-6 space-y-3">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">{pub.type}</span>
          {pub.category && <span>· {pub.category.nameEn}</span>}
          {pub.publishedAt && <span>· {new Date(pub.publishedAt).toLocaleDateString()}</span>}
        </div>

        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">{pickLocale(pub.title, locale)}</h1>

        {pub.summary && (
          <p className="text-lg text-gray-600 dark:text-gray-300">{pickLocale(pub.summary, locale)}</p>
        )}

        {pub.authors.length > 0 && (
          <p className="text-sm text-gray-500">By {pub.authors.join(', ')}</p>
        )}

        {availableLocales.length > 1 && (
          <div className="flex gap-1 pt-2">
            {availableLocales.map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={`rounded px-3 py-1 text-xs font-medium ${locale === l ? 'bg-emerald-600 text-white' : 'border text-gray-600'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </header>

      <div
        className="prose prose-emerald mt-8 max-w-none dark:prose-invert"
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        dangerouslySetInnerHTML={{ __html: pickLocale(pub.contentHtml, locale) }}
      />

      {pub.attachments && pub.attachments.length > 0 && (
        <section className="mt-12 rounded-lg border bg-gray-50 p-6 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold">Downloads</h2>
          <ul className="space-y-2">
            {pub.attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={`/api/v1/drive/files/${a.fileId}/download`}
                  className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:underline"
                >
                  <Download className="h-4 w-4" />
                  {a.caption || `${a.kind} attachment`}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pub.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {pub.tags.map((t) => (
            <Link
              key={t}
              href={`/knowledge/search?q=${encodeURIComponent(t)}`}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
            >
              #{t}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
