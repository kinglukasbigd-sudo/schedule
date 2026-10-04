import { expect, test } from '@playwright/test';
import { freshApp, onboardByTyping, quickAdd } from './helpers';

test('works offline after the first visit', async ({ page, context }) => {
  await freshApp(page);
  await onboardByTyping(page);
  await quickAdd(page, 'English worksheet');
  // Wait until the service worker controls the page.
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('next-up')).toContainText('English worksheet');
  await page.getByRole('button', { name: 'Week' }).click();
  await expect(page.getByTestId('week-grid')).toBeVisible();
  await context.setOffline(false);
});
