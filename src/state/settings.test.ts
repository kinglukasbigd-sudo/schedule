import { beforeEach, describe, expect, it } from 'vitest';
import { eraseEverything } from '@/db/backup';
import { saveSettings } from '@/db/repo';
import { DEFAULT_SETTINGS } from '@/domain/types';
import { useSettings } from './settings';

beforeEach(async () => {
  await eraseEverything();
});

describe('settings store', () => {
  it('hydrates from the database', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, accent: 'green', onboarded: true });
    await useSettings.getState().hydrate();
    expect(useSettings.getState().settings).toMatchObject({ accent: 'green', onboarded: true });
  });

  it('starts fresh after everything was erased, instead of keeping what is in memory', async () => {
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS, accent: 'red', onboarded: true } });
    await eraseEverything();
    await useSettings.getState().hydrate();
    expect(useSettings.getState().settings).toMatchObject({ accent: 'blue', onboarded: false });
  });
});
