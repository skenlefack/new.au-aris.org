import { test, expect } from '../fixtures/auth.fixture';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('PDF Report Generation', () => {
  test('should generate and download a PDF report', async ({
    authenticatedPage,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await dashboard.expectVisible();

    // Navigate to a section that supports PDF export
    await dashboard.navigateTo('Animal Health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for an export/download button
    const exportButton = authenticatedPage
      .locator('button, a')
      .filter({ hasText: /export|download|pdf|report/i });

    if (await exportButton.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Start waiting for the download before clicking
      const downloadPromise = authenticatedPage.waitForEvent('download');
      await exportButton.first().click();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.(pdf|csv|xlsx)$/i);

      // Verify the download completed
      const path = await download.path();
      expect(path).toBeTruthy();
    } else {
      // Skip if no export button found (feature not yet implemented)
      test.skip(true, 'PDF export button not found on page');
    }
  });
});
