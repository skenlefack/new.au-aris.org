'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompatIssue {
  feature: string;
  message: string;
}

function detectCompat(): CompatIssue[] {
  const issues: CompatIssue[] = [];

  if (typeof window === 'undefined') return issues;

  // IndexedDB
  if (!('indexedDB' in window)) {
    issues.push({
      feature: 'IndexedDB',
      message: 'Offline data storage is not available.',
    });
  }

  // Service Worker
  if (!('serviceWorker' in navigator)) {
    issues.push({
      feature: 'Service Worker',
      message: 'Offline caching is not available.',
    });
  }

  // Cache API
  if (!('caches' in window)) {
    issues.push({
      feature: 'Cache API',
      message: 'Asset caching is not available.',
    });
  }

  // Storage API (quota management)
  if (!navigator.storage?.estimate) {
    issues.push({
      feature: 'Storage API',
      message: 'Storage quota management is not available.',
    });
  }

  return issues;
}

/**
 * Detects the browser name and version.
 */
function getBrowserInfo(): { name: string; version: number } | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;

  // Chrome / Chromium
  const chromeMatch = ua.match(/Chrom(?:e|ium)\/(\d+)/);
  if (chromeMatch) return { name: 'Chrome', version: parseInt(chromeMatch[1], 10) };

  // Firefox
  const ffMatch = ua.match(/Firefox\/(\d+)/);
  if (ffMatch) return { name: 'Firefox', version: parseInt(ffMatch[1], 10) };

  // Safari
  const safariMatch = ua.match(/Version\/(\d+).*Safari/);
  if (safariMatch) return { name: 'Safari', version: parseInt(safariMatch[1], 10) };

  // Edge (legacy)
  const edgeMatch = ua.match(/Edg\/(\d+)/);
  if (edgeMatch) return { name: 'Edge', version: parseInt(edgeMatch[1], 10) };

  return null;
}

// Minimum browser versions for full offline support
const MIN_VERSIONS: Record<string, number> = {
  Chrome: 80,
  Firefox: 78,
  Safari: 15,
  Edge: 80,
};

export function BrowserCompatCheck() {
  const [issues, setIssues] = useState<CompatIssue[]>([]);
  const [browserWarning, setBrowserWarning] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    if (sessionStorage.getItem('aris-compat-dismissed')) {
      setDismissed(true);
      return;
    }

    const detected = detectCompat();
    setIssues(detected);

    const browser = getBrowserInfo();
    if (browser) {
      const minVersion = MIN_VERSIONS[browser.name];
      if (minVersion && browser.version < minVersion) {
        setBrowserWarning(
          `${browser.name} ${browser.version} is outdated. Please update to version ${minVersion}+ for the best experience.`,
        );
      }
    }
  }, []);

  if (dismissed || (issues.length === 0 && !browserWarning)) return null;

  return (
    <div
      role="alert"
      className={cn(
        'fixed bottom-4 left-4 z-50 max-w-md rounded-lg border shadow-lg',
        'border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950',
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Browser Compatibility
          </h3>

          {browserWarning && (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              {browserWarning}
            </p>
          )}

          {issues.length > 0 && (
            <ul className="mt-2 space-y-1">
              {issues.map((issue) => (
                <li key={issue.feature} className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>{issue.feature}:</strong> {issue.message}
                </li>
              ))}
            </ul>
          )}

          <a
            href="https://browsehappy.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 underline hover:text-amber-900 dark:text-amber-400"
          >
            Update your browser <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <button
          onClick={() => {
            setDismissed(true);
            sessionStorage.setItem('aris-compat-dismissed', 'true');
          }}
          className="rounded p-1 text-amber-500 hover:text-amber-700 dark:text-amber-400"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
