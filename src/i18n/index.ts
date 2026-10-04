import type { Locale } from 'date-fns';
import { enGB } from 'date-fns/locale/en-GB';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Language } from '@/domain/types';
import en from './locales/en.json';

/** Native names, shown in the language picker. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', mk: 'Македонски', de: 'Deutsch' };

const dateLocales: Partial<Record<Language, Locale>> = { en: enGB };

/** English ships in the main bundle (it is also the fallback); others load on demand. */
const loaders: Record<Exclude<Language, 'en'>, () => Promise<[Record<string, unknown>, Locale]>> = {
  mk: () => Promise.all([import('./locales/mk.json').then((m) => m.default), import('date-fns/locale/mk').then((m) => m.mk)]),
  de: () => Promise.all([import('./locales/de.json').then((m) => m.default), import('date-fns/locale/de').then((m) => m.de)]),
};

export function dateLocale(language: string): Locale {
  return dateLocales[language as Language] ?? enGB;
}

async function ensureLoaded(language: Language): Promise<void> {
  if (language === 'en' || dateLocales[language]) return;
  const [strings, locale] = await loaders[language]();
  i18n.addResourceBundle(language, 'translation', strings, true, true);
  dateLocales[language] = locale;
}

/** Initialise once, or switch language; resolves when the new language is ready to render. */
export async function setLanguage(language: Language): Promise<void> {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources: { en: { translation: en } },
      lng: 'en',
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }
  try {
    await ensureLoaded(language);
  } catch (err) {
    console.error('[i18n]', err);
    return;
  }
  if (i18n.language !== language) await i18n.changeLanguage(language);
}

export default i18n;
