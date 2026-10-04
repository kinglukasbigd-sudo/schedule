import { expect, test } from '@playwright/test';
import { MONDAY_MORNING, SAMPLE_WEEK } from './helpers';

/**
 * A student updating from v1: their IndexedDB holds a v1 database (schema version 1, Dexie's
 * IndexedDB version 10). The first launch of the new app must upgrade it in place (SPEC §9.2).
 */
const v1 = {
  settings: { id: 'main', theme: 'system', accent: 'blue', language: 'en', onboarded: true },
  subjects: [...new Set(Object.values(SAMPLE_WEEK).flatMap((d) => d.split(', ')))].map((name, i) => ({
    id: `s${i}`,
    name,
    color: ['sky', 'rose', 'mint', 'amber', 'lilac', 'coral', 'teal', 'iris', 'lime', 'orchid'][i % 10],
    createdAt: i + 1,
  })),
  bells: ['08:00', '08:50', '09:40', '10:30', '11:20', '12:10'].map((start) => {
    const [h, m] = start.split(':').map(Number) as [number, number];
    const end = h * 60 + m + 45;
    return { start, end: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}` };
  }),
};

test('a v1 database is upgraded on first launch and everything is still there', async ({ page }) => {
  const subjects = v1.subjects;
  const id = (name: string) => subjects.find((s) => s.name === name)?.id as string;
  const timetable = {
    id: 'main',
    days: [1, 2, 3, 4, 5],
    bells: v1.bells,
    lessons: Object.entries(SAMPLE_WEEK).flatMap(([day, list]) => list.split(', ').map((name, period) => ({ day: Number(day), period, subjectId: id(name) }))),
    updatedAt: MONDAY_MORNING.getTime(),
  };
  const tasks = [
    { id: 't1', kind: 'homework', title: 'Worksheet p. 12', subjectId: id('Biology'), due: '2026-10-05', period: 2, notes: '', doneAt: null, createdAt: 1, updatedAt: 1 },
    { id: 't2', kind: 'test', title: 'Chemistry test', subjectId: id('Chemistry'), due: '2026-10-07', period: 0, notes: '', doneAt: null, createdAt: 2, updatedAt: 2 },
  ];

  await page.clock.install({ time: MONDAY_MORNING });
  await page.addInitScript(
    ({ settings, subjects, timetable, tasks }) => {
      if (sessionStorage.getItem('v1-seeded')) return;
      sessionStorage.setItem('v1-seeded', '1');
      // Exactly the stores and indexes v1's Dexie schema created.
      const req = indexedDB.open('term', 10);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('subjects', { keyPath: 'id' }).createIndex('name', 'name');
        const t = db.createObjectStore('tasks', { keyPath: 'id' });
        for (const index of ['due', 'subjectId', 'doneAt']) t.createIndex(index, index);
        db.createObjectStore('timetables', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'id' });
        const tx = req.transaction as IDBTransaction;
        for (const s of subjects) tx.objectStore('subjects').put(s);
        for (const task of tasks) tx.objectStore('tasks').put(task);
        tx.objectStore('timetables').put(timetable);
        tx.objectStore('settings').put(settings);
      };
      req.onsuccess = () => req.result.close();
    },
    { settings: v1.settings, subjects, timetable, tasks },
  );
  await page.goto('/');

  // Straight to Today: onboarding is remembered, lessons and tasks survived.
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
  const lessons = page.getByTestId('lessons');
  await expect(lessons.getByRole('button')).toHaveCount(5);
  await expect(lessons.getByRole('button', { name: /English/ })).toHaveAttribute('aria-current', 'time');
  await expect(lessons.getByRole('button', { name: /09:40 Biology/ })).toContainText('Worksheet p. 12');
  await expect(page.getByTestId('next-up')).toContainText('Chemistry test');

  // The database itself is now version 2 (IndexedDB 20) with the new tables.
  const stores = await page.evaluate(
    () =>
      new Promise<{ version: number; stores: string[] }>((resolve) => {
        const req = indexedDB.open('term');
        req.onsuccess = () => {
          const db = req.result;
          resolve({ version: db.version, stores: [...db.objectStoreNames].sort() });
          db.close();
        };
      }),
  );
  expect(stores).toEqual({ version: 20, stores: ['attachments', 'holidays', 'settings', 'subjects', 'tasks', 'timetables'] });

  // And it keeps working: editing after the upgrade persists across a reload.
  await page.getByRole('button', { name: 'Tasks' }).click();
  await page.getByTestId('task-row').filter({ hasText: 'Worksheet p. 12' }).getByRole('checkbox').click();
  // The snackbar confirms the change once it is stored.
  await expect(page.getByTestId('toast')).toContainText('Done: Worksheet p. 12');
  await page.reload();
  await page.getByRole('button', { name: 'Tasks' }).click();
  await expect(page.getByTestId('task-row').filter({ hasText: 'Chemistry test' })).toBeVisible();
  await expect(page.getByTestId('task-row').filter({ hasText: 'Worksheet p. 12' })).toBeHidden();
});
