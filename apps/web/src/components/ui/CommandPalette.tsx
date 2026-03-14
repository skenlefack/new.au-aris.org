'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  Search,
  Activity,
  BarChart3,
  Globe,
  Shield,
  ShieldCheck,
  FileText,
  Layers,
  Zap,
  Settings,
  Bell,
  Fish,
  Bug,
  TreePine,
  Flame,
  ArrowRightLeft,
  Landmark,
  Cloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/lib/stores/ui-store';
import { useTranslations } from '@/lib/i18n/translations';

interface RouteItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  section: string;
}

const ROUTES: RouteItem[] = [
  { label: 'Dashboard', href: '/', icon: <BarChart3 className="h-4 w-4" />, section: 'Navigation' },
  { label: 'Animal Health — Events', href: '/animal-health/events', icon: <Activity className="h-4 w-4" />, section: 'Animal Health' },
  { label: 'Animal Health — Surveillance', href: '/animal-health/surveillance', icon: <Shield className="h-4 w-4" />, section: 'Animal Health' },
  { label: 'Animal Health — Lab Results', href: '/animal-health/lab', icon: <Bug className="h-4 w-4" />, section: 'Animal Health' },
  { label: 'Livestock — Census', href: '/livestock/census', icon: <Layers className="h-4 w-4" />, section: 'Production' },
  { label: 'Livestock — Production', href: '/livestock/production', icon: <Layers className="h-4 w-4" />, section: 'Production' },
  { label: 'Fisheries', href: '/fisheries', icon: <Fish className="h-4 w-4" />, section: 'Domains' },
  { label: 'Wildlife & Biodiversity', href: '/wildlife', icon: <TreePine className="h-4 w-4" />, section: 'Domains' },
  { label: 'Apiculture', href: '/apiculture', icon: <Flame className="h-4 w-4" />, section: 'Domains' },
  { label: 'Trade & SPS', href: '/trade-sps', icon: <ArrowRightLeft className="h-4 w-4" />, section: 'Domains' },
  { label: 'Governance', href: '/governance', icon: <Landmark className="h-4 w-4" />, section: 'Domains' },
  { label: 'Climate & Environment', href: '/climate-env', icon: <Cloud className="h-4 w-4" />, section: 'Domains' },
  { label: 'Master Data', href: '/master-data', icon: <Globe className="h-4 w-4" />, section: 'Data Hub' },
  { label: 'Data Quality', href: '/quality/reports', icon: <ShieldCheck className="h-4 w-4" />, section: 'Data Hub' },
  { label: 'Workflow', href: '/workflow', icon: <Zap className="h-4 w-4" />, section: 'Data Hub' },
  { label: 'Reports', href: '/reports', icon: <FileText className="h-4 w-4" />, section: 'Data Hub' },
  { label: 'Notifications', href: '/notifications', icon: <Bell className="h-4 w-4" />, section: 'Settings' },
  { label: 'Settings', href: '/settings', icon: <Settings className="h-4 w-4" />, section: 'Settings' },
];

export function CommandPalette() {
  const t = useTranslations('shared');
  const open = useUiStore((s) => s.searchOpen);
  const setOpen = useUiStore((s) => s.setSearchOpen);
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? ROUTES.filter(
        (r) =>
          r.label.toLowerCase().includes(query.toLowerCase()) ||
          r.section.toLowerCase().includes(query.toLowerCase()),
      )
    : ROUTES;

  // Reset query and focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-item]');
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router, setOpen],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' && filtered[activeIndex]) {
        e.preventDefault();
        handleSelect(filtered[activeIndex].href);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    },
    [filtered, activeIndex, handleSelect, setOpen],
  );

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  // Group by section
  const sections: Record<string, RouteItem[]> = {};
  for (const route of filtered) {
    if (!sections[route.section]) sections[route.section] = [];
    sections[route.section].push(route);
  }

  let globalIndex = -1;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPagesActions')}
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
            aria-label="Search pages"
          />
          <kbd className="hidden rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-400 sm:inline dark:border-gray-600">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-auto px-2 py-2" role="listbox">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-400">
              {t('noResults')}
            </p>
          ) : (
            Object.entries(sections).map(([section, items]) => (
              <div key={section}>
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {section}
                </p>
                {items.map((item) => {
                  globalIndex++;
                  const idx = globalIndex;
                  return (
                    <button
                      key={item.href}
                      data-item
                      role="option"
                      aria-selected={idx === activeIndex}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm',
                        idx === activeIndex
                          ? 'bg-aris-primary-50 text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-400'
                          : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800',
                      )}
                      onClick={() => handleSelect(item.href)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <span className="text-gray-400 dark:text-gray-500">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-gray-200 px-4 py-2 text-[10px] text-gray-400 dark:border-gray-700">
          <span>
            <kbd className="rounded border border-gray-200 px-1 dark:border-gray-600">&uarr;</kbd>{' '}
            <kbd className="rounded border border-gray-200 px-1 dark:border-gray-600">&darr;</kbd>{' '}
            {t('navigate')}
          </span>
          <span>
            <kbd className="rounded border border-gray-200 px-1 dark:border-gray-600">Enter</kbd>{' '}
            {t('selectItem')}
          </span>
          <span>
            <kbd className="rounded border border-gray-200 px-1 dark:border-gray-600">Esc</kbd>{' '}
            close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
