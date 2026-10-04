import { useEffect } from 'react';
import type { Settings } from '@/domain/types';
import { useMediaQuery } from './useMediaQuery';

/** Apply theme, accent and language to <html>, and keep the browser chrome colour in sync. */
export function useApplyAppearance(settings: Settings): void {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.accent = settings.accent;
    root.lang = settings.language;
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${bg.replace(/\s+/g, ',')})`);
  }, [theme, settings.accent, settings.language]);
}
