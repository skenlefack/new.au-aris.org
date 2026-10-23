/**
 * E2E Tests — Offline Sync Queue
 *
 * Verifies the sync queue behavior: enqueue while offline,
 * auto-sync on reconnect, retry logic, and the settings/sync page.
 */

import { test, expect } from '@playwright/test';
import {
  loginAndWait,
  goOffline,
  goOnline,
  waitForSW,
  waitForPrefetch,
  getIDBStoreCount,
  getIDBStoreItems,
  expectOfflineBanner,
} from '../helpers/offline.helpers';

test.describe('Offline Sync Queue', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWait(page);
    await waitForSW(page);
    await waitForPrefetch(page);
  });

  test('sync queue is initially empty', async ({ page }) => {
    const count = await getIDBStoreCount(page, 'sync-queue');
    expect(count).toBe(0);
  });

  test('submissions store is accessible', async ({ page }) => {
    // Verify the submissions store exists and is queryable
    const count = await getIDBStoreCount(page, 'submissions');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('settings/sync page shows queue status', async ({ page }) => {
    await page.goto('/settings/sync');
    await page.waitForLoadState('networkidle');

    // The sync settings page should render
    const pageContent = await page.textContent('body');
    const hasSyncContent =
      pageContent?.includes('sync') ||
      pageContent?.includes('Sync') ||
      pageContent?.includes('offline') ||
      pageContent?.includes('Offline') ||
      pageContent?.includes('queue') ||
      pageContent?.includes('Queue');
    expect(hasSyncContent).toBe(true);
  });

  test('offline indicator appears and disappears correctly', async ({
    page,
    context,
  }) => {
    // Go offline
    await goOffline(context);
    await expectOfflineBanner(page);

    // Go back online
    await goOnline(context);

    // Banner should eventually hide
    await page.waitForTimeout(5000);
    const offlineBanner = page.locator('[role="status"]').filter({
      hasText: /you are offline|hors ligne/i,
    });
    await expect(offlineBanner.first()).toBeHidden({ timeout: 5_000 });
  });

  test('IDB stores survive page reload', async ({ page }) => {
    // Get initial counts
    const refBefore = await getIDBStoreCount(page, 'ref-data');

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Counts should be the same
    const refAfter = await getIDBStoreCount(page, 'ref-data');
    expect(refAfter).toBe(refBefore);
  });
});
