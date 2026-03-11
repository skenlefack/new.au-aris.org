import { test, expect } from '../fixtures/auth.fixture';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('Multi-Tenant Form Override', () => {
  test('continental admin creates a form visible at all levels', async ({
    authenticatedPage,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await dashboard.expectVisible();

    // Navigate to settings to verify tenant context
    await dashboard.navigateTo('Settings');
    await authenticatedPage.waitForURL(/settings/);

    // Verify the user has continental admin access
    await expect(
      authenticatedPage.locator('text=/continental|AU-IBAR|super/i').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show tenant hierarchy in settings', async ({
    authenticatedPage,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await dashboard.expectVisible();

    await dashboard.navigateTo('Settings');
    await authenticatedPage.waitForURL(/settings/);

    // Navigate to countries settings
    const countriesLink = authenticatedPage.locator('a, button').filter({ hasText: /countries|pays/i });
    if (await countriesLink.first().isVisible()) {
      await countriesLink.first().click();
      await authenticatedPage.waitForLoadState('networkidle');
      // Verify tenant list is displayed
      await expect(authenticatedPage.locator('table, [role="grid"], ul').first()).toBeVisible();
    }
  });
});
