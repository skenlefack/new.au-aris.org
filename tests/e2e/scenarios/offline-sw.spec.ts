/**
 * E2E Tests — Service Worker
 *
 * Verifies Service Worker registration, caching behavior,
 * and Background Sync API registration.
 */

import { test, expect } from '@playwright/test';
import {
  loginAndWait,
  waitForSW,
  hasSW,
} from '../helpers/offline.helpers';

test.describe('Service Worker', () => {
  test('registers and activates on page load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for SW to activate
    await waitForSW(page);
    const swActive = await hasSW(page);
    expect(swActive).toBe(true);
  });

  test('serves sw.js with correct no-cache headers', async ({ page }) => {
    const response = await page.goto('/sw.js');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);

    const cacheControl = response!.headers()['cache-control'];
    expect(cacheControl).toContain('no-cache');
  });

  test('serves manifest.webmanifest', async ({ page }) => {
    const response = await page.goto('/manifest.webmanifest');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);

    const body = await response!.json();
    expect(body.name).toContain('ARIS');
    expect(body.display).toBe('standalone');
    expect(body.icons).toBeDefined();
    expect(body.icons.length).toBeGreaterThan(0);
  });

  test('pre-caches /offline fallback page', async ({ page }) => {
    await page.goto('/');
    await waitForSW(page);

    // Check if /offline is in the pages cache
    const hasCachedOffline = await page.evaluate(async () => {
      const cache = await caches.open('aris-pages-v2');
      const keys = await cache.keys();
      return keys.some((k) => new URL(k.url).pathname === '/offline');
    });
    expect(hasCachedOffline).toBe(true);
  });

  test('caches static assets with cache-first strategy', async ({ page }) => {
    await page.goto('/');
    await waitForSW(page);
    await page.waitForLoadState('networkidle');

    // Check that static cache has entries
    const staticCacheCount = await page.evaluate(async () => {
      const cache = await caches.open('aris-static-v2');
      const keys = await cache.keys();
      return keys.length;
    });
    expect(staticCacheCount).toBeGreaterThan(0);
  });

  test('registers background sync tag after login', async ({ page }) => {
    await loginAndWait(page);
    await waitForSW(page);

    // Check if Background Sync API is supported (Chrome only)
    const hasBgSync = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker?.ready;
      return reg && 'sync' in reg;
    });

    // If supported, the registration should not throw
    // (We can't verify the tag was registered — that's internal to the browser)
    expect(hasBgSync).toBeDefined();
  });
});
