/**
 * E2E Tests — Offline Navigation
 *
 * Verifies that cached pages are accessible when offline,
 * including RSC payloads for Next.js App Router navigation.
 */

import { test, expect } from '@playwright/test';
import {
  loginAndWait,
  goOffline,
  goOnline,
  waitForSW,
  waitForPrefetch,
  expectOfflineBanner,
  expectBackOnlineBanner,
} from '../helpers/offline.helpers';

test.describe('Offline Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWait(page);
    await waitForSW(page);
    await waitForPrefetch(page);
  });

  test('shows offline banner when going offline', async ({ page, context }) => {
    await goOffline(context);
    await expectOfflineBanner(page);
  });

  test('shows back-online banner when reconnecting', async ({ page, context }) => {
    await goOffline(context);
    await expectOfflineBanner(page);

    await goOnline(context);
    await expectBackOnlineBanner(page);
  });

  test('navigates to cached pages while offline', async ({ page, context }) => {
    // Visit some pages to cache them
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await page.goto('/settings/sync');
    await page.waitForLoadState('networkidle');

    // Go offline
    await goOffline(context);

    // Navigate back to /home — should be cached
    await page.goto('/home');
    // Page should render (not show the offline fallback)
    const hasContent = await page.locator('nav, [role="navigation"], main').first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasContent).toBe(true);
  });

  test('shows offline fallback for uncached pages', async ({ page, context }) => {
    await goOffline(context);

    // Try to access a page we haven't visited
    await page.goto('/wildlife/cites');

    // Should show offline fallback or cached app shell
    const body = await page.textContent('body');
    const isOfflineFallback = body?.includes('offline') || body?.includes('Offline') || body?.includes('ARIS');
    expect(isOfflineFallback).toBe(true);
  });

  test('recovers navigation after going back online', async ({ page, context }) => {
    await goOffline(context);
    await expectOfflineBanner(page);

    await goOnline(context);
    await page.waitForTimeout(2000); // Network stabilization

    // Navigate to a page — should work normally
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav.first()).toBeVisible({ timeout: 10_000 });
  });
});
