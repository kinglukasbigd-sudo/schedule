import { afterAll, beforeAll } from 'vitest';

/** SPEC E-10: DST rules are tested in these zones (Lord Howe shifts by 30 minutes). */
export const DST_ZONES = ['Europe/Skopje', 'Europe/Berlin', 'America/New_York', 'Australia/Lord_Howe'] as const;

/**
 * Run the enclosing describe block in another IANA zone. Node re-reads TZ when it is assigned, and
 * each test file runs in its own process (Vitest's `forks` pool), so this can't leak elsewhere.
 */
export function inZone(zone: string) {
  let previous: string | undefined;
  beforeAll(() => {
    previous = process.env.TZ;
    process.env.TZ = zone;
  });
  afterAll(() => {
    process.env.TZ = previous;
  });
}
