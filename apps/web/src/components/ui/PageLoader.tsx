'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

/* ── Page-ready signaling ─────────────────────────────────────────────── */

const PageReadyContext = createContext<{
  signalReady: () => void;
  /** True once the current page called signalReady() */
  isReady: boolean;
}>({ signalReady: () => {}, isReady: false });

/**
 * Hook for pages to signal that their critical data is loaded.
 * Call `usePageReady(isLoaded)` — the route-change loader stays visible
 * until isLoaded becomes true.
 */
export function usePageReady(isLoaded: boolean) {
  const { signalReady } = useContext(PageReadyContext);
  useEffect(() => {
    if (isLoaded) signalReady();
  }, [isLoaded, signalReady]);
}

/**
 * Full-screen branded loading overlay (for initial app load / auth pages).
 * Covers the entire viewport.
 */
export function PageLoader({ fadeOut }: { fadeOut?: boolean }) {
  return (
    <div className={`page-loader ${fadeOut ? 'page-loader-fade-out' : ''}`}>
      <LoaderContent />
    </div>
  );
}

/**
 * Content-area loader — covers only the main content zone,
 * leaving the sidebar and header visible.
 * Uses absolute positioning within its parent container.
 */
export function ContentLoader({ fadeOut }: { fadeOut?: boolean }) {
  return (
    <div className={`content-loader ${fadeOut ? 'content-loader-fade-out' : ''}`}>
      <LoaderContent />
    </div>
  );
}

/**
 * Shared animated loader visuals (spinner, logo, dots, decorative circles).
 */
function LoaderContent() {
  return (
    <>
      {/* Decorative background circles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-20 -right-20 h-72 w-72 rounded-full page-loader-circle-1"
          style={{ background: 'radial-gradient(circle, rgba(var(--color-accent-rgb), 0.06) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full page-loader-circle-2"
          style={{ background: 'radial-gradient(circle, rgba(var(--color-accent-rgb), 0.05) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 right-1/4 h-32 w-32 rounded-full page-loader-circle-3"
          style={{ border: '1.5px solid rgba(var(--color-accent-rgb), 0.06)' }}
        />
      </div>

      {/* Centered content */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Animated logo spinner */}
        <div className="relative">
          {/* Outer spinning ring */}
          <div className="page-loader-ring" />
          {/* Inner logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/au-logo.png"
              alt="ARIS"
              className="h-10 w-10 object-contain page-loader-logo"
            />
          </div>
        </div>

        {/* Text */}
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aris-logo.png" alt="ARIS" className="h-8 object-contain mx-auto" />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 tracking-wider uppercase">
            Loading
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          <span className="page-loader-dot" style={{ animationDelay: '0ms' }} />
          <span className="page-loader-dot" style={{ animationDelay: '150ms' }} />
          <span className="page-loader-dot" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </>
  );
}

/**
 * Top navigation progress bar, shown at the very top of the page during transitions.
 */
export function TopProgressBar() {
  return (
    <div className="top-progress-bar" />
  );
}

/**
 * Detects route changes and shows a content-area loader during navigation.
 * Only covers the main content zone — sidebar and header stay visible.
 *
 * How it works:
 * 1. Intercepts clicks on <a> links that trigger client-side navigation
 * 2. Shows the ContentLoader overlay immediately on click
 * 3. Waits for the page to signal "ready" via usePageReady() before fading out
 * 4. Falls back to hiding after pathname change + 300ms if no signal is received
 * 5. Safety timeout at 8s max
 */
export function RouteChangeLoader() {
  const pathname = usePathname();
  const { isReady: pageReady } = useContext(PageReadyContext);
  const [loading, setLoading] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const prevPathRef = useRef(pathname);
  const routeArrivedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const dismiss = useCallback(() => {
    setFadeOut(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setFadeOut(false);
      routeArrivedRef.current = false;
    }, 300);
  }, []);

  // Track when pathname changes (route component mounted)
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      routeArrivedRef.current = true;
      // Wait for usePageReady signal. If none after 600ms, dismiss (pages without signal).
      // Don't check pageReady here — it may still be stale from previous page.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        dismiss();
      }, 600);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [pathname, dismiss]);

  // When page signals ready → dismiss loader
  useEffect(() => {
    if (pageReady && loading && routeArrivedRef.current) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      dismiss();
    }
  }, [pageReady, loading, dismiss]);

  // Safety: hide loader after 8s max
  useEffect(() => {
    if (!loading) return;
    const safety = setTimeout(() => dismiss(), 8000);
    return () => clearTimeout(safety);
  }, [loading, dismiss]);

  // Intercept link clicks to show loader
  const handleClick = useCallback(
    (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Skip external links, hash links, special protocols
      if (
        href.startsWith('http') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        anchor.getAttribute('target') === '_blank' ||
        anchor.hasAttribute('download')
      ) {
        return;
      }

      // Skip if modifier keys held (open in new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Skip if already on this page
      if (href === pathname) return;

      setLoading(true);
      setFadeOut(false);
      routeArrivedRef.current = false;
    },
    [pathname],
  );

  useEffect(() => {
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [handleClick]);

  if (!loading) return null;

  return <ContentLoader fadeOut={fadeOut} />;
}

/**
 * Wraps children and provides the page-ready signaling context.
 * Place this in the dashboard layout around {children}.
 */
export function PageReadyProvider({ children }: { children: React.ReactNode }) {
  return (
    <PageReadySignalProvider>
      {children}
    </PageReadySignalProvider>
  );
}

function PageReadySignalProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  // Reset ready state synchronously on every pathname change
  // Using a key-based remount ensures clean state
  const signalReady = useCallback(() => setReady(true), []);
  const value = React.useMemo(() => ({ signalReady, isReady: ready }), [signalReady, ready]);

  // Reset on pathname change — use layout effect for synchronous reset before children render
  const prevRef = useRef(pathname);
  if (prevRef.current !== pathname) {
    prevRef.current = pathname;
    if (ready) setReady(false);
  }

  return (
    <PageReadyContext.Provider value={value}>
      {children}
    </PageReadyContext.Provider>
  );
}
