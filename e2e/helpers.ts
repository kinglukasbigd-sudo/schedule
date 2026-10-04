import { expect, type Page } from '@playwright/test';

/**
 * Fixed instants for page.clock. The browser runs in Europe/Skopje (playwright.config.ts), which is
 * on CEST (UTC+2) until 25 October 2026. The offset is written out so that the instant doesn't
 * depend on the time zone of the machine running the tests: a bare "2026-10-05T09:10:00" is parsed
 * in Node's zone and lands two hours later on a UTC machine.
 */
/** Monday 5 October 2026, 09:10 — during period 2 of the sample timetable. */
export const MONDAY_MORNING = new Date('2026-10-05T09:10:00+02:00');
/** Wednesday 7 October 2026, 07:30 — before the first lesson (Chemistry, 08:00). */
export const WEDNESDAY_EARLY = new Date('2026-10-07T07:30:00+02:00');

export const SAMPLE_WEEK: Record<number, string> = {
  1: 'Mathematics, English, Biology, Biology, Physical Education',
  2: 'English, Mathematics, German, History, Art',
  3: 'Chemistry, Mathematics, English, German, German, Music',
  4: 'German, English, Mathematics, Geography',
  5: 'Physical Education, Biology, Mathematics, English',
};

export async function freshApp(page: Page, at: Date = MONDAY_MORNING) {
  await page.clock.install({ time: at });
  await page.goto('/');
  await expect(page.getByTestId('setup-welcome')).toBeVisible();
}

/**
 * Wait until animations have finished: no Web Animation is running (framer-motion runs opacity
 * and transforms there) and inline styles have stopped changing (it drives other values, like
 * height, by writing styles each frame). Use before measuring sizes or contrast: mid-animation
 * elements are scaled or partly transparent.
 */
export async function settle(page: Page) {
  const snapshot = () =>
    page.evaluate(() => {
      const running = document.getAnimations().filter((a) => a.playState === 'running').length;
      const styles = [...document.querySelectorAll('[style]')].map((el) => el.getAttribute('style')).join('\n');
      return { running, styles };
    });
  let last = await snapshot();
  await expect
    .poll(
      async () => {
        const now = await snapshot();
        const settled = now.running === 0 && now.styles === last.styles;
        last = now;
        return settled;
      },
      { intervals: [100], timeout: 5_000 },
    )
    .toBe(true);
}

/**
 * Open Settings from Today or Week and wait for it. Screens cross-fade, so without the wait a
 * locator can still match the outgoing screen (e.g. Today's "11:20 Physical Education" lesson).
 */
export async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
}

/** The typed onboarding path, start to finish. */
export async function onboardByTyping(page: Page, week = SAMPLE_WEEK) {
  await page.getByTestId('start').click();
  await page.getByTestId('method-type').click();
  for (const [day, text] of Object.entries(week)) await page.getByTestId(`day-${day}`).fill(text);
  await page.getByTestId('type-continue').click();
  await expect(page.getByTestId('setup-review')).toBeVisible();
  await page.getByTestId('review-confirm').click();
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
}

export async function quickAdd(page: Page, text: string) {
  await page.getByTestId('fab').click();
  const sheet = page.getByTestId('task-sheet');
  await expect(sheet).toBeVisible();
  await sheet.locator('#task-title').fill(text);
  await sheet.getByTestId('task-save').click();
  await expect(sheet).toBeHidden();
}

/** Week grid / review grid as HTML, used to render PDFs and screenshots for import tests. */
export function timetableHtml(): string {
  const rows = [
    ['08:00 – 08:45', 'Mathematics', 'English', 'Biology', 'Mathematics', 'Physics'],
    ['08:50 – 09:35', 'English', 'Mathematics', 'Chemistry', 'History', 'Physics'],
    ['09:35 – 09:55', 'Break', 'Break', 'Break', 'Break', 'Break'],
    ['09:55 – 10:40', 'History', 'Art', 'Mathematics', 'English', 'Music'],
    ['10:45 – 11:30', 'Biology', 'Chemistry', 'English', 'Art', 'Mathematics'],
  ];
  const cell = (c: string) => `<td>${c}</td>`;
  return `<!doctype html><html><head><style>
    body { font-family: Arial, sans-serif; padding: 32px; background: #fff; color: #111; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #999; padding: 14px 10px; font-size: 18px; text-align: left; }
    th { background: #eee; }
  </style></head><body>
    <h1 style="font-size:22px">Class 9B — Timetable</h1>
    <table><tr><th>Time</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th></tr>
    ${rows.map((r) => `<tr>${r.map(cell).join('')}</tr>`).join('')}
    </table></body></html>`;
}
