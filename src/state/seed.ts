import { demoData } from '@/logic/demo';
import { useData } from './data';

/** Replace everything with DESIGN's example week, moved to the current week. Development only. */
export async function seedDemo(now = new Date()): Promise<void> {
  await useData.getState().replaceAll({ ...demoData(now), attachments: [] });
}
