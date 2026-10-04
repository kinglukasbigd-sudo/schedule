import { isNative } from './platform';

/** A light tap on native platforms; silent on the web (vibration there feels broken). */
export async function tapFeedback(style: 'light' | 'medium' = 'light'): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: style === 'light' ? ImpactStyle.Light : ImpactStyle.Medium });
  } catch {
    // Haptics are a nicety; never let them break an action.
  }
}
