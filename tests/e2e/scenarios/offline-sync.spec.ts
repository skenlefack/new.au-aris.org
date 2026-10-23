/**
 * E2E Tests — Offline Sync (Integration)
 *
 * End-to-end test of the full offline workflow:
 * login → prefetch → go offline → verify data accessible → go online → sync.
 */

import { test, expect } from '@playwright/test';
import {
  loginAndWait,
  goOffline,
  goOnline,
  waitForSW,
  waitForPrefetch,
  getIDBStoreCount,
  hasAuthTokensInIDB,
  expectOfflineBanner,
  expectBackOnlineBanner,
} from '../helpers/offline.helpers';

test.describe('Offline Sync — Full Workflow', () => {
  test('complete offline lifecycle: login → prefetch → offline → online', async ({
    page,
    context,
  }) => {
    // 1. Login and wait for prefetch
    await loginAndWait(page);
    await waitForSW(page);
    await waitForPrefetch(page);

    // 2. Verify data was prefetched
    const refCount = await getIDBStoreCount(page, 'ref-data');
    expect(refCount).toBeGreaterThan(0);

    const hasTokens = await hasAuthTokensInIDB(page);
    expect(hasTokens).toBe(true);

    // 3. Go offline
    await goOffline(context);
    await expectOfflineBanner(page);

    // 4. Navigate to a cached page
    await page.goto('/home');
    const hasNav = await page.locator('nav, [role="navigation"]').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    // Should have cached content (either full page or app shell)
    expect(hasNav || (await page.textContent('body'))?.includes('ARIS')).toBeTruthy();

    // 5. Go back online
    await goOnline(context);
    await expectBackOnlineBanner(page);

    // 6. Verify recovery
    await page.waitForTimeout(3000); // Network stabilization
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav.first()).toBeVisible({ timeout: 10_000 });
  });

  test('IDB data persists across navigation while offline', async ({
    page,
    context,
  }) => {
    await loginAndWait(page);
    await waitForSW(page);
    await waitForPrefetch(page);

    const countBefore = await getIDBStoreCount(page, 'ref-data');

    // Go offline and navigate
    await goOffline(context);
    await page.goto('/home');
    await page.waitForTimeout(1000);

    // IDB should still have the same data
    const countAfter = await getIDBStoreCount(page, 'ref-data');
    expect(countAfter).toBe(countBefore);
  });

  test('sync queue is empty when no offline mutations occurred', async ({
    page,
    context,
  }) => {
    await loginAndWait(page);
    await waitForSW(page);

    // Go offline and back online without doing anything
    await goOffline(context);
    await page.waitForTimeout(1000);
    await goOnline(context);
    await page.waitForTimeout(2000);

    // Sync queue should be empty
    const queueCount = await getIDBStoreCount(page, 'sync-queue');
    expect(queueCount).toBe(0);
  });
});
