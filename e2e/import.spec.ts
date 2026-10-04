import { expect, test, type Page } from '@playwright/test';
import { freshApp, timetableHtml } from './helpers';

async function importFile(page: Page, path: string) {
  await page.getByTestId('start').click();
  await expect(page.getByTestId('setup-method')).toBeVisible();
  await page.getByTestId('file-input').setInputFiles(path);
}

async function expectSampleTimetable(page: Page) {
  await expect(page.getByTestId('setup-review')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('review-summary')).toHaveText(/20 lessons, 8 subjects/);
  await expect(page.getByTestId('cell-1-0')).toHaveAccessibleName(/^Mathematics, Monday/);
  await expect(page.getByTestId('cell-3-1')).toHaveAccessibleName(/^Chemistry, Wednesday/);
  await expect(page.getByTestId('cell-5-3')).toHaveAccessibleName(/^Mathematics, Friday/);
  // The break row is gone: period 3 is the 09:55 lesson.
  await expect(page.getByRole('button', { name: 'Change times of period 3' })).toContainText('09:55');
}

test('a PDF timetable is read from its text layer', async ({ page, browser }, info) => {
  const render = await browser.newPage();
  await render.setContent(timetableHtml());
  const pdf = info.outputPath('timetable.pdf');
  await render.pdf({ path: pdf, format: 'A4', landscape: true });
  await render.close();

  await freshApp(page);
  await importFile(page, pdf);
  await expectSampleTimetable(page);
});

test('a screenshot is read with on-device OCR', async ({ page, browser }, info) => {
  test.skip(!!process.env.E2E_OFFLINE, 'OCR language data downloads from the CDN on first use');
  test.slow();
  const render = await browser.newPage({ viewport: { width: 1100, height: 520 } });
  await render.setContent(timetableHtml());
  const png = info.outputPath('timetable.png');
  await render.screenshot({ path: png });
  await render.close();

  await freshApp(page);
  await importFile(page, png);
  await expectSampleTimetable(page);
});

test('a file without a timetable explains what to do', async ({ page }, info) => {
  const path = info.outputPath('notes.pdf');
  const render = await page.context().newPage();
  await render.setContent('<p style="font:20px Arial">Shopping list: milk, eggs, bread.</p>');
  await render.pdf({ path });
  await render.close();

  await freshApp(page);
  await importFile(page, path);
  await expect(page.getByRole('alert')).toContainText(/couldn't find a timetable|didn't work/);
  await page.getByTestId('method-type').click();
  await expect(page.getByTestId('setup-type')).toBeVisible();
});
