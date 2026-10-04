/**
 * True inside the Capacitor iOS/Android shell. The native runtime injects `window.Capacitor`
 * before the app loads, so we can check it without bundling @capacitor/core up front.
 */
export function isNative(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() ?? false;
}
