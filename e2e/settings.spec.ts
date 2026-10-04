import { expect, test } from '@playwright/test';
import { freshApp, onboardByTyping, openSettings } from './helpers';

test('theme, accent and language persist across reloads', async ({ page }) => {
  await freshApp(page);
  await onboardByTyping(page);
  await openSettings(page);

  await page.getByRole('radio', { name: 'Dark' }).click();
  await page.getByRole('radio', { name: 'Green' }).click();
  await page.getByRole('radio', { name: 'Deutsch' }).click();
  await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();

  await page.reload();
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-accent', 'green');
  await expect(html).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('heading', { name: 'Heute', level: 1 })).toBeVisible();
  await expect(page.getByText('MONTAG, 5. OKTOBER').or(page.getByText('Montag, 5. Oktober'))).toBeVisible();
});

test('renaming and recolouring a subject updates the week', async ({ page }) => {
  await freshApp(page);
  await onboardByTyping(page);
  await openSettings(page);
  await page.getByRole('button', { name: 'Physical Education', exact: true }).click();
  const sheet = page.getByTestId('subject-sheet');
  await sheet.locator('#subject-name').fill('Sport');
  await sheet.getByRole('button', { name: 'Lime' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Week' }).click();
  await expect(page.getByTestId('week-grid').getByRole('button', { name: /^Sport, Monday/ })).toHaveClass(/subject-lime/);
});

test('backup export, erase, and restore round-trips everything', async ({ page }, info) => {
  await freshApp(page);
  await onboardByTyping(page);
  await openSettings(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const file = info.outputPath('backup.json');
  await (await download).saveAs(file);

  await page.getByRole('button', { name: 'Erase everything' }).click();
  await page.getByRole('button', { name: 'Tap again to erase everything' }).click();
  await expect(page.getByTestId('setup-welcome')).toBeVisible();
  // Undo is offered even for erase.
  await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();

  await openSettings(page);
  await page.locator('input[type=file][accept*=json]').setInputFiles(file);
  await expect(page.getByTestId('toast')).toContainText('Backup restored');
});

test('timetable edits save automatically', async ({ page }) => {
  await freshApp(page);
  await onboardByTyping(page);
  await openSettings(page);
  await page.getByRole('button', { name: 'Edit timetable' }).click();
  await page.getByTestId('cell-4-4').click();
  await page.getByTestId('cell-sheet').locator('#cell-subject').fill('Drama');
  await page.getByTestId('cell-sheet').getByTestId('cell-save').click();
  await page.getByRole('button', { name: 'Week' }).click();
  await expect(page.getByTestId('week-grid').getByRole('button', { name: /^Drama, Thursday/ })).toBeVisible();
});
