import { useState } from 'react';
import { TaskSheet } from '@/features/task-sheet/TaskSheet';
import { useUI, type Sheet } from '@/state/ui';
import { LessonSheet } from './LessonSheet';
import { SubjectSheet } from './SubjectSheet';

type Of<T extends Sheet['type']> = Extract<Sheet, { type: T }>;

/** Renders the active sheet and keeps the last payload alive during its exit animation. */
export function SheetHost() {
  const sheet = useUI((s) => s.sheet);
  const seq = useUI((s) => s.sheetSeq);
  const [last, setLast] = useState<Partial<{ [K in Sheet['type']]: Of<K> }>>({});

  // Remember the latest payload per sheet type (state adjusted during render, not in an effect).
  if (sheet && last[sheet.type] !== sheet) setLast({ ...last, [sheet.type]: sheet });

  const current = <K extends Sheet['type']>(type: K): Of<K> | null =>
    sheet?.type === type ? (sheet as Of<K>) : ((last[type] as Of<K> | undefined) ?? null);

  return (
    <>
      <TaskSheet state={current('task')} open={sheet?.type === 'task'} seq={seq} />
      <LessonSheet state={current('lesson')} open={sheet?.type === 'lesson'} />
      <SubjectSheet state={current('subject')} open={sheet?.type === 'subject'} seq={seq} />
    </>
  );
}
