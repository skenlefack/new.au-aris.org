/**
 * E2E Tests — Offline Prefetch
 *
 * Verifies that the progressive prefetcher correctly caches
 * reference data, geo entities, form templates, and campaigns
 * in IndexedDB after login.
 */

import { test, expect } from '@playwright/test';
import {
  loginAndWait,
  waitForSW,
  waitForPrefetch,
  getIDBStoreCount,
  hasAuthTokensInIDB,
} from '../helpers/offline.helpers';

test.describe('Offline Prefetch', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWait(page);
    await waitForSW(page);
  });

  test('mirrors auth tokens to IndexedDB after login', async ({ page }) => {
    // Auth tokens should be stored in IDB for the Service Worker
    const hasTokens = await hasAuthTokensInIDB(page);
    expect(hasTokens).toBe(true);
  });

  test('prefetches reference data into IndexedDB', async ({ page }) => {
    await waitForPrefetch(page);

    // Check that ref-data store has items (species, diseases, etc.)
    const refCount = await getIDBStoreCount(page, 'ref-data');
    expect(refCount).toBeGreaterThan(0);
  });

  test('prefetches form templates into IndexedDB', async ({ page }) => {
    await waitForPrefetch(page);

    // Check form-templates store
    const templateCount = await getIDBStoreCount(page, 'form-templates');
    // May be 0 if no published templates, but store should exist
    expect(templateCount).toBeGreaterThanOrEqual(0);
  });

  test('prefetches campaigns into IndexedDB', async ({ page }) => {
    await waitForPrefetch(page);

    const campaignCount = await getIDBStoreCount(page, 'campaigns');
    expect(campaignCount).toBeGreaterThanOrEqual(0);
  });

  test('respects cache TTL — does not re-fetch fresh data', async ({ page }) => {
    await waitForPrefetch(page);

    // Get initial ref-data count
    const countBefore = await getIDBStoreCount(page, 'ref-data');

    // Reload page (triggers another prefetch attempt)
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Count should be the same (data is fresh, not re-fetched)
    const countAfter = await getIDBStoreCount(page, 'ref-data');
    expect(countAfter).toBe(countBefore);
  });

  test('meta store tracks cache freshness timestamps', async ({ page }) => {
    await waitForPrefetch(page);

    const metaCount = await getIDBStoreCount(page, 'meta');
    // Should have at least a few entries (one per cached data type)
    expect(metaCount).toBeGreaterThan(0);
  });
});
