'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

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
          <p
            className="text-lg font-bold tracking-tight"
            style={{ color: '#800020' }}
          >
            ARIS
          </p>
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
 * 3. When usePathname() changes (route arrived), fades out and hides
 */
export function RouteChangeLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const prevPathRef = useRef(pathname);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // When the pathname actually changes → fade out the loader
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      if (loading) {
        setFadeOut(true);
        timeoutRef.current = setTimeout(() => {
          setLoading(false);
          setFadeOut(false);
        }, 300);
      }
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [pathname, loading]);

  // Safety: hide loader after 5s max (in case route never changes)
  useEffect(() => {
    if (!loading) return;
    const safety = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        setLoading(false);
        setFadeOut(false);
      }, 300);
    }, 5000);
    return () => clearTimeout(safety);
  }, [loading]);

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
