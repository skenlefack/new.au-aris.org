import { type Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class FormBuilderPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/collecte/forms');
    await this.waitForPageReady();
  }

  async clickNewForm(): Promise<void> {
    const newButton = this.page.locator('button, a').filter({ hasText: /new|create|nouveau/i });
    await newButton.first().click();
    await this.waitForPageReady();
  }

  async fillFormDetails(name: string, description: string): Promise<void> {
    const nameInput = this.page.locator('input[name="name"], input[name="title"]').first();
    await nameInput.fill(name);

    const descInput = this.page.locator('textarea[name="description"], input[name="description"]').first();
    if (await descInput.isVisible()) {
      await descInput.fill(description);
    }
  }

  async publishForm(): Promise<void> {
    const publishButton = this.page.locator('button').filter({ hasText: /publish|publier/i });
    await publishButton.first().click();
    await this.waitForPageReady();
  }

  async expectFormInList(name: string): Promise<void> {
    await expect(this.page.locator('table, [role="grid"], ul').locator(`text=${name}`).first()).toBeVisible();
  }
}
