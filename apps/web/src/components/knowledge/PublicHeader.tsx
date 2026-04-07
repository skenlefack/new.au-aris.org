'use client';

// Shared header for the public Knowledge Hub. Contains the AU logo brand
// link and a persistent Google-style search bar that submits to the search
// results page. Used on every (public)/knowledge/* route except the hero
// landing page (which renders its own larger search input).

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search } from 'lucide-react';

interface Props {
  initialQuery?: string;
  /** Optional badge text shown next to the brand (e.g. category name). */
  context?: string;
}

export function PublicKnowledgeHeader({ initialQuery = '', context }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/knowledge/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur dark:bg-gray-900/90">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <Link href="/knowledge" className="flex shrink-0 items-center gap-3">
          <Image
            src="/au-logo.png"
            alt="African Union"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            priority
          />
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-bold text-emerald-700">AU-IBAR</span>
            <span className="text-xs text-muted-foreground">Knowledge Hub</span>
          </div>
        </Link>

        <form onSubmit={onSubmit} className="flex-1">
          <div className="flex items-center rounded-full border border-gray-300 bg-white px-4 py-2 transition-shadow focus-within:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <Search className="mr-2 h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the knowledge base…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                clear
              </button>
            )}
          </div>
        </form>

        {context && (
          <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 lg:inline-block">
            {context}
          </span>
        )}
      </div>
    </header>
  );
}
