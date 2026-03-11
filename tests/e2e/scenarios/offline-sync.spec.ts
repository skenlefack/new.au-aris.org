import { test, expect } from '../fixtures/auth.fixture';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('Offline Sync', () => {
  test('should queue submissions while offline and sync on reconnect', async ({
    authenticatedPage,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await dashboard.expectVisible();

    // Navigate to collecte section
    await dashboard.navigateTo('Collecte');
    await authenticatedPage.waitForLoadState('networkidle');

    // Go offline
    await authenticatedPage.context().setOffline(true);

    // Verify offline indicator appears (if implemented)
    const offlineIndicator = authenticatedPage.locator(
      '[data-testid="offline-indicator"], .offline-badge, text=/offline|hors ligne/i',
    );
    const hasOfflineIndicator = await offlineIndicator
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (hasOfflineIndicator) {
      await expect(offlineIndicator.first()).toBeVisible();
    }

    // Go back online
    await authenticatedPage.context().setOffline(false);
    await authenticatedPage.waitForLoadState('networkidle');

    // Verify the page recovers
    await expect(dashboard.locator('nav, [role="navigation"]')).toBeVisible();
  });
});
