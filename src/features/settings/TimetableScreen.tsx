import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useSubjects, useTimetable } from '@/db/hooks';
import { applyDraft, toDraft } from '@/db/repo';
import { defaultBells, WORK_WEEK } from '@/domain/schedule';
import type { DraftTimetable } from '@/domain/types';
import { TimetableEditor } from '@/features/timetable/TimetableEditor';
import { useUI } from '@/state/ui';

/** Edits save as you go — there is no Save button to forget. */
export function TimetableScreen() {
  const { t } = useTranslation();
  const back = useUI((s) => s.back);
  const tt = useTimetable();
  const { list, byId, ready } = useSubjects();
  const [draft, setDraft] = useState<DraftTimetable | null>(null);

  // Initialise once from the database; afterwards local state is the source of truth.
  const loaded = tt !== undefined && ready;
  const current: DraftTimetable | null =
    draft ?? (loaded ? (tt ? toDraft(tt, byId) : { days: WORK_WEEK, bells: defaultBells(), cells: [] }) : null);

  return (
    <>
      <ScreenHeader
        title={t('settings.editTimetable')}
        eyebrow={t('editor.autosave')}
        leading={<IconButton icon="chevronLeft" label={t('common.back')} onClick={back} />}
      />
      {current && (
        <TimetableEditor
          draft={current}
          existing={list}
          onChange={(next) => {
            setDraft(next);
            void applyDraft(next);
          }}
        />
      )}
    </>
  );
}
