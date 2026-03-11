import { type Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  private readonly sidebar = this.page.locator('nav, [role="navigation"]');

  constructor(page: Page) {
    super(page);
  }

  async expectVisible(): Promise<void> {
    await expect(this.sidebar).toBeVisible();
  }

  async navigateTo(section: string): Promise<void> {
    const link = this.sidebar.locator(`a, button`).filter({ hasText: new RegExp(section, 'i') });
    await link.first().click();
    await this.waitForPageReady();
  }

  async expectHeading(text: string): Promise<void> {
    await expect(this.page.locator('h1, h2').filter({ hasText: new RegExp(text, 'i') }).first()).toBeVisible();
  }
}
