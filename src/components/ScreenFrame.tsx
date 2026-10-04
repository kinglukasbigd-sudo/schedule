import { m, useIsPresent, type HTMLMotionProps } from 'framer-motion';
import { cx } from '@/lib/cx';

/**
 * A screen inside <AnimatePresence>. While it animates out it no longer takes taps or clicks, so
 * a quick second tap can't land on a screen that is already leaving (for example a lesson row on
 * Today opening a sheet over Settings, or a second Back being swallowed).
 */
export function ScreenFrame({ className, ...props }: HTMLMotionProps<'div'>) {
  const present = useIsPresent();
  return <m.div {...props} className={cx(className, !present && 'pointer-events-none')} />;
}
