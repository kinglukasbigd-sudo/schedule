import { generateStudyPlan, replan, type FreeSlots, type PlanOptions } from '@/logic/studyPlan';
import type { ID } from '@/logic/types';
import { saveTask, type Applied } from './actions';
import { useData } from './data';

/** Kept apart from the other actions so the planner loads only when someone plans (N-1). */

/** *Plan my studying* (F-9): planned sessions replace unfinished ones; the rest stay. */
export function planStudy(id: ID, slots: FreeSlots, options: PlanOptions = {}): Applied | null {
  const task = useData.getState().tasks.find((t) => t.id === id);
  if (!task || task.kind === 'homework') return null;
  const others = useData.getState().tasks;
  const next = task.plan
    ? replan(task, slots, others, options)
    : (() => {
        const { subtasks, plan } = generateStudyPlan(task, slots, others, options);
        return { ...task, subtasks: [...task.subtasks, ...subtasks], plan };
      })();
  return saveTask(next);
}
