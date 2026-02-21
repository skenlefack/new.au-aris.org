'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUiStore } from '@/lib/stores/ui-store';

export function useKeyboardShortcuts() {
  const router = useRouter();
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const searchOpen = useUiStore((s) => s.searchOpen);
  const shortcutsOpen = useUiStore((s) => s.shortcutsOpen);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      // Ctrl/Cmd+K — open command palette (works even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // Ctrl/Cmd+N — new (context-aware)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        // Navigate based on current path
        const path = window.location.pathname;
        if (path.includes('animal-health')) {
          router.push('/animal-health/events/new');
        } else if (path.includes('workflow')) {
          router.push('/workflow/new');
        } else if (path.includes('quality')) {
          router.push('/quality/reports/new');
        } else {
          // Default — open command palette for selection
          setSearchOpen(true);
        }
        return;
      }

      // Escape — close modals/panels
      if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false);
          return;
        }
        if (shortcutsOpen) {
          setShortcutsOpen(false);
          return;
        }
      }

      // ? — show shortcuts help (only when not in an input)
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router, setSearchOpen, setShortcutsOpen, searchOpen, shortcutsOpen]);
}
