import { create } from 'zustand';
import { loadSettings, saveSettings } from '@/db/repo';
import { DEFAULT_SETTINGS, LANGUAGES, type Language, type Settings } from '@/domain/types';

export const BOOT_KEY = 'term:boot';

interface SettingsState {
  settings: Settings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

/** First-run language guess from the device, limited to supported languages. */
export function detectLanguage(): Language {
  const langs = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  for (const l of langs) {
    const base = l.slice(0, 2).toLowerCase();
    if ((LANGUAGES as readonly string[]).includes(base)) return base as Language;
  }
  return 'en';
}

/** Mirror look-and-feel to localStorage so index.html can paint the right theme before React loads. */
function mirror(settings: Settings) {
  try {
    localStorage.setItem(
      BOOT_KEY,
      JSON.stringify({ theme: settings.theme, accent: settings.accent, language: settings.language }),
    );
  } catch {
    // Storage can be unavailable (private mode); the theme then applies a frame later.
  }
}

const freshSettings = (): Settings => ({ ...DEFAULT_SETTINGS, language: detectLanguage() });

export const useSettings = create<SettingsState>((set, get) => ({
  settings: freshSettings(),
  hydrated: false,
  hydrate: async () => {
    // Nothing stored means a first run or erased data: start fresh. Keeping the in-memory
    // settings here would keep `onboarded` after "Erase everything".
    const settings = (await loadSettings().catch(() => null)) ?? freshSettings();
    mirror(settings);
    set({ settings, hydrated: true });
  },
  update: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    mirror(settings);
    saveSettings(settings).catch((err: unknown) => console.error('[settings]', err));
  },
  reset: () => {
    const settings = freshSettings();
    set({ settings });
    mirror(settings);
  },
}));
