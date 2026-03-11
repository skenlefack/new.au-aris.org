import { test, expect } from '../fixtures/auth.fixture';
import { FormBuilderPage } from '../pages/form-builder.page';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('Form Lifecycle', () => {
  test('should login, navigate to forms, create and publish a form', async ({
    authenticatedPage,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await dashboard.expectVisible();

    // Navigate to collecte/forms
    await dashboard.navigateTo('Collecte');
    await authenticatedPage.waitForURL(/collecte/);

    const formBuilder = new FormBuilderPage(authenticatedPage);
    await formBuilder.goto();

    // Create a new form
    await formBuilder.clickNewForm();
    const formName = `Test Form ${Date.now()}`;
    await formBuilder.fillFormDetails(formName, 'Automated test form');

    // Verify the form was created
    await formBuilder.goto();
    await formBuilder.expectFormInList(formName);
  });
});
