import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { freshApp, onboardByTyping, openSettings, quickAdd, settle } from './helpers';

async function audit(page: Page, label: string) {
  // Mid-animation text is partly transparent, which axe reports as low contrast.
  await settle(page);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    serious.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`),
  ).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`every screen passes axe in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await freshApp(page);
    await audit(page, 'welcome');
    await page.getByTestId('start').click();
    await audit(page, 'method');
    await page.getByTestId('method-type').click();
    await audit(page, 'type');
    await onboardByTypingFromTypeStep(page);
    await audit(page, 'today-empty');
    await quickAdd(page, 'Math test friday');
    await quickAdd(page, 'English exercises 4-7');
    await audit(page, 'today');
    await page.getByTestId('fab').click();
    await audit(page, 'task-sheet');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Week' }).click();
    await audit(page, 'week');
    await page.getByTestId('week-grid').getByRole('button').first().click();
    await audit(page, 'lesson-sheet');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Tasks' }).click();
    await audit(page, 'tasks');
    await openSettings(page);
    await audit(page, 'settings');
    await page.getByRole('button', { name: 'Edit timetable' }).click();
    await audit(page, 'timetable');
  });
}

async function onboardByTypingFromTypeStep(page: Page) {
  // Wait for each step: a second click during the transition would hit the outgoing screen.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'How do you have it?', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('start')).toBeVisible();
  await onboardByTyping(page);
}

test('keyboard only: add a task and close the sheet with Escape', async ({ page }) => {
  await freshApp(page);
  await onboardByTyping(page);
  await page.getByTestId('fab').focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByTestId('task-sheet');
  await expect(sheet.locator('#task-title')).toBeFocused();
  await page.keyboard.type('Bio worksheet');
  await page.keyboard.press('Enter');
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId('fab')).toBeFocused();
  await expect(page.getByTestId('next-up')).toContainText('Bio worksheet');
});

test('tap targets are at least 44px', async ({ page }) => {
  const smallTargets = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('button, [role=button], [role=checkbox], [role=radio], a[href], input, textarea')]
        .filter((el) => el.offsetParent !== null && !el.closest('[aria-hidden=true]'))
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.height < 44 || r.width < 44))
        .map(({ el, r }) => `${el.tagName} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`),
    );
  await freshApp(page);
  await onboardByTyping(page);
  // Measure after enter animations: the FAB scales in from 60 %.
  await settle(page);
  expect(await smallTargets()).toEqual([]);
  await openSettings(page);
  await settle(page);
  expect(await smallTargets()).toEqual([]);
});
