import type { Transition } from 'framer-motion';

/** The only springs in the app. Reduced motion is handled globally by <MotionConfig reducedMotion="user">. */
export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 1 },
  gentle: { type: 'spring', stiffness: 320, damping: 32, mass: 1 },
  sheet: { type: 'spring', stiffness: 420, damping: 40, mass: 1 },
} satisfies Record<string, Transition>;

export const fade: Transition = { duration: 0.16, ease: [0.22, 1, 0.36, 1] };

export const press = { whileTap: { scale: 0.97 }, transition: spring.snappy } as const;
