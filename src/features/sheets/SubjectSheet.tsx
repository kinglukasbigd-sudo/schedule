import { m } from 'framer-motion';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { useSubjects } from '@/db/hooks';
import { deleteSubject, restoreSubject, updateSubject } from '@/db/repo';
import { SUBJECT_COLORS, type Subject, type SubjectColor } from '@/domain/types';
import { cx } from '@/lib/cx';
import { press } from '@/lib/motion';
import { useUI, type Sheet as SheetState } from '@/state/ui';

type SubjectState = Extract<SheetState, { type: 'subject' }>;

export function SubjectSheet({ state, open, seq }: { state: SubjectState | null; open: boolean; seq: number }) {
  const { t } = useTranslation();
  const { byId } = useSubjects();
  const close = useUI((s) => s.closeSheet);
  const subject = state ? byId.get(state.subjectId) : undefined;
  return (
    <Sheet open={open} onClose={close} title={t('subjectSheet.title')} testId="subject-sheet">
      {subject && <SubjectForm key={seq} subject={subject} onDone={close} />}
    </Sheet>
  );
}

function SubjectForm({ subject, onDone }: { subject: Subject; onDone: () => void }) {
  const { t } = useTranslation();
  const showToast = useUI((s) => s.showToast);
  const [name, setName] = useState(subject.name);
  const [color, setColor] = useState<SubjectColor>(subject.color);

  const save = async () => {
    await updateSubject(subject.id, { name: name.trim() || subject.name, color });
    onDone();
  };

  const remove = async () => {
    const snapshot = await deleteSubject(subject.id);
    onDone();
    if (snapshot) {
      showToast({
        message: t('toast.subjectDeleted', { name: subject.name }),
        action: { label: t('common.undo'), run: () => void restoreSubject(snapshot) },
      });
    }
  };

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div>
        <label htmlFor="subject-name" className="mb-1 block text-caption font-semibold uppercase tracking-wide text-ink-3">
          {t('subjectSheet.name')}
        </label>
        <input
          id="subject-name"
          data-autofocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md bg-surface-2 px-4 py-3 text-lead text-ink"
          autoComplete="off"
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-3">{t('subjectSheet.color')}</legend>
        <div className="grid grid-cols-6 gap-1">
          {SUBJECT_COLORS.map((c) => (
            <m.button
              key={c}
              type="button"
              {...press}
              aria-pressed={c === color}
              aria-label={t(`colors.${c}`)}
              onClick={() => setColor(c)}
              className={cx(`subject-${c}`, 'flex h-12 items-center justify-center')}
            >
              <span
                className={cx(
                  'flex h-10 w-10 items-center justify-center rounded-full bg-subj-bg text-subj-fg transition-shadow duration-fast',
                  c === color && 'ring-2 ring-subj-dot ring-offset-2 ring-offset-surface',
                )}
              >
                {c === color && <Icon name="check" size={20} strokeWidth={2.5} />}
              </span>
            </m.button>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-2">
        <Button variant="danger" icon="trash" onClick={() => void remove()}>
          {t('common.delete')}
        </Button>
        <Button type="submit" variant="primary" size="lg" className="flex-1">
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
