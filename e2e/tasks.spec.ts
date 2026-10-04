import { expect, test } from '@playwright/test';
import { WEDNESDAY_EARLY, freshApp, onboardByTyping, openSettings, quickAdd } from './helpers';

test.beforeEach(async ({ page }) => {
  await freshApp(page);
  await onboardByTyping(page);
});

test('quick add understands "math test friday"', async ({ page }) => {
  await page.getByTestId('fab').click();
  const sheet = page.getByTestId('task-sheet');
  await sheet.locator('#task-title').fill('Math test friday');
  await expect(sheet.getByRole('radio', { name: 'Test' })).toHaveAttribute('aria-checked', 'true');
  await expect(sheet.getByRole('button', { name: 'Mathematics' })).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.getByRole('button', { name: 'Mathematics' })).toBeInViewport();
  await expect(sheet.getByTestId('due-summary')).toHaveText('Friday, 9 October · Mathematics at 09:40');
  await sheet.getByTestId('task-save').click();

  const next = page.getByTestId('next-up');
  await expect(next).toContainText('Math test');
  await expect(next).not.toContainText('friday');
  await expect(next).toContainText('Due Friday at 09:40 · in 4 days');
});

test('homework defaults to the next lesson of its subject', async ({ page }) => {
  await page.getByTestId('fab').click();
  const sheet = page.getByTestId('task-sheet');
  await sheet.locator('#task-title').fill('Read chapter 4');
  await sheet.getByRole('button', { name: 'Biology' }).click();
  // Biology is next today at 09:40 (period 3).
  await expect(sheet.getByRole('button', { name: 'Next lesson · today' })).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.getByTestId('due-summary')).toContainText('Biology at 09:40');
  await sheet.getByTestId('task-save').click();
  await expect(page.getByTestId('lessons').getByRole('button', { name: /Biology/ }).first()).toContainText('Read chapter 4');
});

test('completing shows undo, and undo restores the task', async ({ page }) => {
  await quickAdd(page, 'English worksheet');
  await page.getByRole('button', { name: 'Tasks' }).click();
  const row = page.getByTestId('task-row').filter({ hasText: 'English worksheet' });
  await row.getByRole('checkbox').click();
  await expect(row).toBeHidden();
  const toast = page.getByTestId('toast');
  await expect(toast).toContainText('Done: English worksheet');
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('task-row').filter({ hasText: 'English worksheet' })).toBeVisible();
});

test('next up puts overdue first, then tests by lead time', async ({ page }) => {
  // Tuesday has no Biology lesson, so the worksheet is due at the end of Tuesday.
  await quickAdd(page, 'Bio worksheet tomorrow');
  await quickAdd(page, 'Chemistry test wednesday');
  // Monday: the test (Wednesday 08:00, 2 days' lead) outranks homework due tomorrow night.
  const top = page.getByTestId('next-up').getByRole('button').first();
  await expect(top).toContainText('Chemistry test');

  // Wednesday before school: the worksheet is overdue and goes first, even ahead of the test.
  await page.clock.setSystemTime(WEDNESDAY_EARLY);
  await page.reload();
  await expect(top).toContainText('Bio worksheet');
  await expect(top).toContainText('Overdue');
});

test('edit and delete with undo', async ({ page }) => {
  await quickAdd(page, 'History essay');
  await page.getByRole('button', { name: 'Tasks' }).click();
  await page.getByTestId('task-row').filter({ hasText: 'History essay' }).getByRole('button', { name: /History essay/ }).click();
  const sheet = page.getByTestId('task-sheet');
  await expect(sheet.locator('#task-title')).toHaveValue('History essay');
  await expect(sheet.getByRole('radio', { name: 'Assignment' })).toHaveAttribute('aria-checked', 'true');
  await sheet.locator('#task-title').fill('History essay — draft');
  await sheet.getByTestId('task-save').click();
  await expect(page.getByTestId('task-row').filter({ hasText: 'History essay — draft' })).toBeVisible();

  await page.getByTestId('task-row').filter({ hasText: 'draft' }).getByRole('button', { name: /draft/ }).click();
  await sheet.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('task-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('task-row')).toHaveCount(1);
});

test('adding from a lesson in the week grid', async ({ page }) => {
  await page.getByRole('button', { name: 'Week' }).click();
  await page.getByTestId('week-grid').getByRole('button', { name: /^History, Tuesday/ }).click();
  const lesson = page.getByTestId('lesson-sheet');
  await expect(lesson).toContainText('Nothing due for this lesson.');
  await lesson.getByRole('button', { name: 'Add for this lesson' }).click();
  const sheet = page.getByTestId('task-sheet');
  await sheet.locator('#task-title').fill('Bring atlas');
  await sheet.getByTestId('task-save').click();
  await expect(page.getByTestId('week-grid').getByRole('button', { name: /^History, Tuesday.*1 due/ })).toBeVisible();
});

test('the Android/browser back button closes a sheet before leaving a screen', async ({ page }) => {
  await openSettings(page);
  await page.getByRole('button', { name: 'Biology', exact: true }).click();
  await expect(page.getByTestId('subject-sheet')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('subject-sheet')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
});
