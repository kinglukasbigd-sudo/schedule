import { expect, test } from '@playwright/test';
import { freshApp, onboardByTyping } from './helpers';

test('typed onboarding fills the week and Today shows the current lesson', async ({ page }) => {
  await freshApp(page);
  const started = Date.now();
  await onboardByTyping(page);
  // The whole typed flow is well inside the 60-second promise (typing is instant here,
  // so this guards against slow transitions or blocking work).
  expect(Date.now() - started).toBeLessThan(15_000);

  const lessons = page.getByTestId('lessons');
  await expect(lessons.getByRole('button')).toHaveCount(5);
  await expect(lessons.getByRole('button', { name: /English/ })).toHaveAttribute('aria-current', 'time');

  await page.getByRole('button', { name: 'Week' }).click();
  const grid = page.getByTestId('week-grid');
  await expect(grid.getByRole('button', { name: /^Chemistry, Wednesday/ })).toBeVisible();
  await expect(grid.getByRole('button', { name: /Music, Wednesday, 12:10–12:55/ })).toBeVisible();
});

test('review step lets you fix a cell before saving', async ({ page }) => {
  await freshApp(page);
  await page.getByTestId('start').click();
  await page.getByTestId('method-type').click();
  await page.getByTestId('day-1').fill('Math, Englsh, Biology');
  await page.getByTestId('day-2').fill('English, Math');
  await page.getByTestId('type-continue').click();
  // "Englsh" was merged into "English" automatically.
  await expect(page.getByTestId('review-summary')).toHaveText(/5 lessons, 3 subjects/);

  await page.getByTestId('cell-1-2').click();
  const sheet = page.getByTestId('cell-sheet');
  await sheet.locator('#cell-subject').fill('Chemistry');
  await sheet.locator('#cell-room').fill('Lab 2');
  await sheet.getByTestId('cell-save').click();
  await expect(page.getByTestId('cell-1-2')).toHaveAccessibleName(/Chemistry/);
  await page.getByTestId('review-confirm').click();

  await page.getByRole('button', { name: 'Week' }).click();
  await expect(page.getByTestId('week-grid').getByRole('button', { name: /Chemistry, Monday, .*Room Lab 2/ })).toBeVisible();
});

test('starting without a timetable offers to add one later', async ({ page }) => {
  await freshApp(page);
  await page.getByRole('button', { name: 'Start without one' }).click();
  await expect(page.getByRole('heading', { name: 'Add your timetable' })).toBeVisible();
  await page.getByRole('button', { name: 'Add timetable' }).click();
  await expect(page.getByTestId('setup-method')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
});
