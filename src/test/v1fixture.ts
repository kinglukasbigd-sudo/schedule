import type { V1Data } from '@/logic/migrate';

/** A v1 database as the v1 app stored it, with the kind of damage real data accumulates. */
export function v1Fixture(): V1Data {
  // Thursday 1 October 2026, 12:00 local.
  const updatedAt = new Date(2026, 9, 1, 12, 0).getTime();
  return {
    settings: { theme: 'dark', accent: 'green', language: 'de', onboarded: true },
    subjects: [
      { id: 'math', name: 'Mathematics', color: 'sky', createdAt: 1 },
      { id: 'eng', name: 'English', color: 'rose', createdAt: 2 },
      { id: 'bio', name: 'Biology', color: 'stone', createdAt: 3 },
      // A duplicate name (different case) from an old bug: merged into "English".
      { id: 'eng2', name: ' english', color: 'lime', createdAt: 4 },
      { id: 'art', name: 'Art', color: 'not-a-colour', createdAt: 5 },
    ],
    timetable: {
      id: 'main',
      days: [1, 2, 3, 4, 5, 9],
      bells: [
        { start: '08:00', end: '08:45' },
        { start: '08:50', end: '09:35' },
        { start: '9:40', end: '10:25' }, // malformed start
        { start: '10:45', end: '10:30' }, // ends before it starts
      ],
      lessons: [
        { day: 1, period: 0, subjectId: 'math', room: ' R4 ' },
        { day: 1, period: 1, subjectId: 'eng2' },
        { day: 1, period: 1, subjectId: 'bio' }, // same slot twice: the first wins
        { day: 2, period: 0, subjectId: 'bio', room: '' },
        { day: 2, period: 7, subjectId: 'math' }, // no such period
        { day: 3, period: 2, subjectId: 'ghost' }, // no such subject
        { day: 4, period: 3, subjectId: 'art' },
      ],
      updatedAt,
    },
    tasks: [
      { id: 't1', kind: 'homework', title: 'Worksheet', subjectId: 'math', due: '2026-10-05', period: 0, notes: 'p. 12', doneAt: null, createdAt: 10, updatedAt: 11 },
      { id: 't2', kind: 'test', title: '', subjectId: 'eng2', due: '2026-10-06', period: 1, notes: '', doneAt: null, createdAt: 12, updatedAt: 12 },
      { id: 't3', kind: 'assignment', title: 'Essay', subjectId: null, due: '2026-09-21', period: null, notes: '', doneAt: 99, createdAt: 13, updatedAt: 13 },
      // Period 0 exists but Wednesday has no lesson there: time snapshot, no lesson link.
      { id: 't4', kind: 'homework', title: 'Read', subjectId: 'ghost', due: '2026-10-07', period: 0, notes: '', doneAt: null, createdAt: 14, updatedAt: 14 },
      // An impossible date falls back to the day it was created.
      { id: 't5', kind: 'quiz', title: 'Odd', subjectId: null, due: '2026-02-30', period: 3, notes: '', doneAt: null, createdAt: updatedAt, updatedAt },
    ],
  };
}
