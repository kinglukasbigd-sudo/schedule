import { isNative } from './platform';

/** Offline support for the web build. Native shells load from the app bundle and skip this. */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV || isNative() || !('serviceWorker' in navigator)) return;
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
