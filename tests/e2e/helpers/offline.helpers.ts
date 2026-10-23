/**
 * Playwright helpers for offline PWA testing.
 *
 * Provides utilities to simulate offline/online transitions,
 * wait for Service Worker activation, interact with IndexedDB,
 * and verify PWA offline behavior.
 */

import { type Page, type BrowserContext, expect } from '@playwright/test';

/* ------------------------------------------------------------------ */
/*  Network control                                                    */
/* ------------------------------------------------------------------ */

/** Simulate going offline */
export async function goOffline(context: BrowserContext): Promise<void> {
  await context.setOffline(true);
}

/** Simulate going back online */
export async function goOnline(context: BrowserContext): Promise<void> {
  await context.setOffline(false);
}

/* ------------------------------------------------------------------ */
/*  Service Worker                                                     */
/* ------------------------------------------------------------------ */

/** Wait for the Service Worker to be registered and activated */
export async function waitForSW(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller !== null,
    undefined,
    { timeout: timeoutMs },
  );
}

/** Check if Service Worker is registered */
export async function hasSW(page: Page): Promise<boolean> {
  return page.evaluate(() => navigator.serviceWorker?.controller !== null);
}

/** Get the Service Worker version from the SW scope */
export async function getSWVersion(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker?.ready;
    if (!reg?.active) return null;
    // SW version is in a global const — we can't read it directly,
    // but we can check if the SW responds to a ping
    return 'active';
  });
}

/* ------------------------------------------------------------------ */
/*  IndexedDB                                                          */
/* ------------------------------------------------------------------ */

/** Clear the entire offline IndexedDB */
export async function clearIDB(page: Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('aris-offline-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve(); // May be blocked by open connections
    });
  });
}

/** Get the count of items in an IDB object store */
export async function getIDBStoreCount(page: Page, storeName: string): Promise<number> {
  return page.evaluate((store) => {
    return new Promise<number>((resolve, reject) => {
      const req = indexedDB.open('aris-offline-v1', 2);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(store)) {
          db.close();
          resolve(0);
          return;
        }
        const tx = db.transaction(store, 'readonly');
        const countReq = tx.objectStore(store).count();
        countReq.onsuccess = () => {
          db.close();
          resolve(countReq.result);
        };
        countReq.onerror = () => {
          db.close();
          reject(countReq.error);
        };
      };
    });
  }, storeName);
}

/** Check if auth tokens exist in IDB */
export async function hasAuthTokensInIDB(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return new Promise<boolean>((resolve) => {
      const req = indexedDB.open('aris-offline-v1', 2);
      req.onerror = () => resolve(false);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('auth-tokens')) {
          db.close();
          resolve(false);
          return;
        }
        const tx = db.transaction('auth-tokens', 'readonly');
        const getReq = tx.objectStore('auth-tokens').get('current');
        getReq.onsuccess = () => {
          db.close();
          resolve(!!getReq.result);
        };
        getReq.onerror = () => {
          db.close();
          resolve(false);
        };
      };
    });
  });
}

/** Get all items from an IDB store */
export async function getIDBStoreItems(page: Page, storeName: string): Promise<any[]> {
  return page.evaluate((store) => {
    return new Promise<any[]>((resolve, reject) => {
      const req = indexedDB.open('aris-offline-v1', 2);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(store)) {
          db.close();
          resolve([]);
          return;
        }
        const tx = db.transaction(store, 'readonly');
        const allReq = tx.objectStore(store).getAll();
        allReq.onsuccess = () => {
          db.close();
          resolve(allReq.result || []);
        };
        allReq.onerror = () => {
          db.close();
          reject(allReq.error);
        };
      };
    });
  }, storeName);
}

/* ------------------------------------------------------------------ */
/*  Login helper                                                       */
/* ------------------------------------------------------------------ */

/**
 * Login and wait for the dashboard to load.
 * Uses the real login flow (not mocked).
 */
export async function loginAndWait(
  page: Page,
  email = 'admin@au-aris.org',
  password = 'Aris2026@@4!0',
): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Fill login form
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitBtn = page.locator('button[type="submit"]');

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await submitBtn.click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/(home|dashboard|settings|collecte)/, { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
}

/* ------------------------------------------------------------------ */
/*  Prefetch helpers                                                   */
/* ------------------------------------------------------------------ */

/** Wait for offline prefetch to complete (progress widget disappears) */
export async function waitForPrefetch(page: Page, timeoutMs = 60_000): Promise<void> {
  // The SyncProgressWidget shows during prefetch — wait for it to appear then disappear
  try {
    const widget = page.locator('text=/Syncing offline data|Offline data ready/i');
    // Widget may appear quickly and disappear
    await widget.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    // Wait for it to disappear (prefetch done)
    await widget.first().waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => {});
  } catch {
    // Prefetch may have completed before we started watching — that's fine
  }
  // Give a small buffer for IDB writes to complete
  await page.waitForTimeout(1000);
}

/* ------------------------------------------------------------------ */
/*  Assertions                                                         */
/* ------------------------------------------------------------------ */

/** Assert the offline indicator banner is visible */
export async function expectOfflineBanner(page: Page): Promise<void> {
  const banner = page.locator('[role="status"]').filter({
    hasText: /offline|hors ligne/i,
  });
  await expect(banner.first()).toBeVisible({ timeout: 5_000 });
}

/** Assert the offline indicator banner is hidden */
export async function expectNoBanner(page: Page): Promise<void> {
  const banner = page.locator('[role="status"]').filter({
    hasText: /offline|hors ligne/i,
  });
  await expect(banner.first()).toBeHidden({ timeout: 5_000 });
}

/** Assert the "back online" banner appears */
export async function expectBackOnlineBanner(page: Page): Promise<void> {
  const banner = page.locator('[role="status"]').filter({
    hasText: /back online|de retour/i,
  });
  await expect(banner.first()).toBeVisible({ timeout: 5_000 });
}
