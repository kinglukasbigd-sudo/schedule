import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteTask, restoreTask, setTaskDone } from '@/db/repo';
import type { Task } from '@/domain/types';
import { tapFeedback } from '@/lib/haptics';
import { useUI } from '@/state/ui';

/**
 * Complete / reopen / delete with an undo toast. The toast host is itself a polite live region, so
 * a change that shows a toast is not announced again; one without a toast is announced instead.
 */
export function useTaskActions() {
  const { t } = useTranslation();
  const showToast = useUI((s) => s.showToast);
  const announce = useUI((s) => s.announce);

  const label = useCallback((task: Task) => task.title || t(`kind.${task.kind}`), [t]);

  const complete = useCallback(
    async (task: Task) => {
      await setTaskDone(task.id, true);
      void tapFeedback();
      const message = t('toast.completed', { title: label(task) });
      showToast({ message, action: { label: t('common.undo'), run: () => void setTaskDone(task.id, false) } });
    },
    [t, label, showToast],
  );

  const reopen = useCallback(
    async (task: Task) => {
      await setTaskDone(task.id, false);
      announce(t('toast.reopened', { title: label(task) }));
    },
    [t, label, announce],
  );

  const remove = useCallback(
    async (task: Task) => {
      const snapshot = await deleteTask(task.id);
      const message = t('toast.deleted', { title: label(task) });
      if (snapshot) showToast({ message, action: { label: t('common.undo'), run: () => void restoreTask(snapshot) } });
      else announce(message);
    },
    [t, label, showToast, announce],
  );

  return { complete, reopen, remove, label };
}
