import { addDays, startOfISOWeek } from 'date-fns';
import { m } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { assignColors } from '@/domain/subjects';
import { formatHm, isValidBell, nextBell, parseHm } from '@/domain/schedule';
import type { Bell, DraftCell, DraftTimetable, Subject, SubjectColor, Weekday } from '@/domain/types';
import { cx } from '@/lib/cx';
import { useFormat } from '@/lib/format';
import { press } from '@/lib/motion';
import { abbreviate, fold } from '@/lib/text';

const ALL_DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const COLS: Record<number, string> = {
  1: 'grid-cols-week-1',
  2: 'grid-cols-week-2',
  3: 'grid-cols-week-3',
  4: 'grid-cols-week-4',
  5: 'grid-cols-week-5',
  6: 'grid-cols-week-6',
  7: 'grid-cols-week-7',
};
const MAX_PERIODS = 14;

interface EditorProps {
  draft: DraftTimetable;
  onChange: (draft: DraftTimetable) => void;
  /** Subjects already in the database: their names are suggested and their colours kept. */
  existing: Subject[];
}

type Editing = { kind: 'cell'; day: Weekday; period: number } | { kind: 'bell'; period: number } | null;

/** Edit days, bell times and lessons. Tap a cell to set its subject, tap a time to change it. */
export function TimetableEditor({ draft, onChange, existing }: EditorProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const [editing, setEditing] = useState<Editing>(null);
  const monday = useMemo(() => startOfISOWeek(new Date()), []);

  const colors = useMemo(
    () => assignColors(draft.cells.map((c) => c.subject), existing),
    [draft.cells, existing],
  );
  const names = useMemo(() => {
    const seen = new Map<string, string>();
    for (const n of [...draft.cells.map((c) => c.subject), ...existing.map((s) => s.name)]) {
      if (!seen.has(fold(n))) seen.set(fold(n), n);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [draft.cells, existing]);

  const cellAt = (day: Weekday, period: number) => draft.cells.find((c) => c.day === day && c.period === period);

  const setCell = (day: Weekday, period: number, value: { subject: string; room?: string } | null) => {
    const rest = draft.cells.filter((c) => !(c.day === day && c.period === period));
    const cells: DraftCell[] = value?.subject.trim()
      ? [...rest, { day, period, subject: value.subject.trim(), ...(value.room?.trim() ? { room: value.room.trim() } : {}) }]
      : rest;
    onChange({ ...draft, cells });
  };

  const toggleDay = (day: Weekday) => {
    const days = draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day].sort((a, b) => a - b);
    if (days.length === 0) return;
    onChange({ ...draft, days });
  };

  const addPeriod = () => {
    if (draft.bells.length >= MAX_PERIODS) return;
    onChange({ ...draft, bells: [...draft.bells, nextBell(draft.bells)] });
  };

  const setBell = (period: number, bell: Bell) => {
    const bells = draft.bells.map((b, i) => (i === period ? bell : b));
    onChange({ ...draft, bells });
  };

  const removePeriod = (period: number) => {
    const bells = draft.bells.filter((_, i) => i !== period);
    const cells = draft.cells
      .filter((c) => c.period !== period)
      .map((c) => (c.period > period ? { ...c, period: c.period - 1 } : c));
    onChange({ ...draft, bells, cells });
  };

  const days = draft.days;

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1 text-caption font-semibold uppercase tracking-wide text-ink-3">{t('editor.days')}</legend>
        <div className="grid grid-cols-7 gap-1">
          {ALL_DAYS.map((d) => {
            const on = days.includes(d);
            return (
              <m.button
                key={d}
                type="button"
                {...press}
                aria-pressed={on}
                aria-label={f.weekday(addDays(monday, d - 1))}
                onClick={() => toggleDay(d)}
                className="flex min-h-11 items-center justify-center"
              >
                <span
                  className={cx(
                    'flex h-9 w-full items-center justify-center rounded-full text-small font-medium transition-colors duration-fast',
                    on ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-2 hover:bg-surface-3',
                  )}
                >
                  {f.weekdayShort(addDays(monday, d - 1))}
                </span>
              </m.button>
            );
          })}
        </div>
      </fieldset>

      <div className={cx('grid gap-1', COLS[days.length])} data-testid="editor-grid">
        <span />
        {days.map((d) => (
          <span key={d} className="pb-1 text-center text-caption font-semibold uppercase text-ink-3">
            {f.weekdayShort(addDays(monday, d - 1))}
          </span>
        ))}
        {draft.bells.map((bell, period) => (
          <Row key={period}>
            <m.button
              type="button"
              {...press}
              onClick={() => setEditing({ kind: 'bell', period })}
              aria-label={t('editor.editTimes', { n: period + 1 })}
              className="flex min-h-14 flex-col items-end justify-center rounded-md pr-1 text-right hover:bg-surface-2"
            >
              <span className="text-small font-semibold text-ink-2">{period + 1}</span>
              <span className="tabular text-caption text-accent">{isValidBell(bell) ? bell.start : '--:--'}</span>
            </m.button>
            {days.map((day) => {
              const cell = cellAt(day, period);
              const color = cell ? colors.get(fold(cell.subject)) : undefined;
              return (
                <m.button
                  key={day}
                  type="button"
                  {...press}
                  onClick={() => setEditing({ kind: 'cell', day, period })}
                  aria-label={
                    cell
                      ? t('editor.cellLabel', { subject: cell.subject, day: f.weekday(addDays(monday, day - 1)), n: period + 1 })
                      : t('editor.emptyCellLabel', { day: f.weekday(addDays(monday, day - 1)), n: period + 1 })
                  }
                  data-testid={`cell-${day}-${period}`}
                  className={cx(
                    'flex min-h-14 flex-col items-start overflow-hidden rounded-md p-2 text-left',
                    cell && color ? `subject-${color} bg-subj-bg text-subj-fg` : 'border border-dashed border-line text-ink-3 hover:bg-surface-2',
                  )}
                >
                  {cell ? (
                    <>
                      <span className="w-full truncate text-caption font-semibold sm:hidden">{abbreviate(cell.subject)}</span>
                      <span className="hidden w-full hyphens-auto break-words text-small font-semibold leading-5 sm:line-clamp-2">{cell.subject}</span>
                      {cell.room && <span className="w-full truncate text-caption opacity-80">{cell.room}</span>}
                    </>
                  ) : (
                    <Icon name="plus" size={16} className="m-auto" />
                  )}
                </m.button>
              );
            })}
          </Row>
        ))}
      </div>

      {draft.bells.length < MAX_PERIODS && (
        <Button variant="ghost" icon="plus" onClick={addPeriod} className="self-start text-accent">
          {t('editor.addPeriod')}
        </Button>
      )}

      <CellSheet
        editing={editing?.kind === 'cell' ? editing : null}
        cell={editing?.kind === 'cell' ? cellAt(editing.day, editing.period) : undefined}
        names={names}
        colors={colors}
        onSave={(day, period, value, advance) => {
          setCell(day, period, value);
          setEditing(advance && period + 1 < draft.bells.length ? { kind: 'cell', day, period: period + 1 } : null);
        }}
        onClose={() => setEditing(null)}
      />
      <BellSheet
        period={editing?.kind === 'bell' ? editing.period : null}
        bell={editing?.kind === 'bell' ? draft.bells[editing.period] : undefined}
        canRemove={draft.bells.length > 1}
        onSave={(period, bell) => {
          setBell(period, bell);
          setEditing(null);
        }}
        onRemove={(period) => {
          removePeriod(period);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="contents">{children}</div>;
}

interface CellSheetProps {
  editing: { day: Weekday; period: number } | null;
  cell: DraftCell | undefined;
  names: string[];
  colors: Map<string, SubjectColor>;
  onSave: (day: Weekday, period: number, value: { subject: string; room?: string } | null, advance: boolean) => void;
  onClose: () => void;
}

function CellSheet({ editing, cell, names, colors, onSave, onClose }: CellSheetProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const monday = useMemo(() => startOfISOWeek(new Date()), []);
  const [last, setLast] = useState(editing);
  if (editing && (editing.day !== last?.day || editing.period !== last?.period)) setLast(editing);
  const target = editing ?? last;

  return (
    <Sheet
      open={editing != null}
      onClose={onClose}
      eyebrow={target ? f.weekday(addDays(monday, target.day - 1)) : undefined}
      title={target ? t('editor.periodN', { n: target.period + 1 }) : ''}
      testId="cell-sheet"
    >
      {target && (
        <CellForm
          key={`${target.day}-${target.period}`}
          cell={cell}
          names={names}
          colors={colors}
          onSave={(value, advance) => onSave(target.day, target.period, value, advance)}
        />
      )}
    </Sheet>
  );
}

function CellForm({
  cell,
  names,
  colors,
  onSave,
}: {
  cell: DraftCell | undefined;
  names: string[];
  colors: Map<string, SubjectColor>;
  onSave: (value: { subject: string; room?: string } | null, advance: boolean) => void;
}) {
  const { t } = useTranslation();
  const [subject, setSubject] = useState(cell?.subject ?? '');
  const [room, setRoom] = useState(cell?.room ?? '');
  const query = fold(subject.trim());
  const suggestions = names.filter((n) => !query || (fold(n).includes(query) && fold(n) !== query)).slice(0, 12);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(subject.trim() ? { subject, room } : null, true);
      }}
    >
      <div>
        <label htmlFor="cell-subject" className="mb-1 block text-caption font-semibold uppercase tracking-wide text-ink-3">
          {t('editor.subject')}
        </label>
        <input
          id="cell-subject"
          data-autofocus
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('editor.subjectPlaceholder')}
          autoComplete="off"
          enterKeyHint="next"
          className="w-full rounded-md bg-surface-2 px-4 py-3 text-lead text-ink placeholder:text-ink-3"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-x-2">
          {suggestions.map((n) => (
            <Chip
              key={n}
              subject={colors.get(fold(n)) ?? 'stone'}
              selected={false}
              onClick={() => onSave({ subject: n, room }, true)}
            >
              {n}
            </Chip>
          ))}
        </div>
      )}
      <div>
        <label htmlFor="cell-room" className="mb-1 block text-caption font-semibold uppercase tracking-wide text-ink-3">
          {t('editor.room')}
        </label>
        <input
          id="cell-room"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder={t('editor.roomPlaceholder')}
          autoComplete="off"
          enterKeyHint="next"
          className="w-full rounded-md bg-surface-2 px-4 py-3 text-body text-ink placeholder:text-ink-3"
        />
      </div>
      <div className="flex items-center gap-2 pt-2">
        {cell && (
          <Button variant="danger" icon="trash" onClick={() => onSave(null, false)}>
            {t('editor.clear')}
          </Button>
        )}
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          onClick={() => onSave(subject.trim() ? { subject, room } : null, false)}
          data-testid="cell-save"
        >
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

interface BellSheetProps {
  period: number | null;
  bell: Bell | undefined;
  canRemove: boolean;
  onSave: (period: number, bell: Bell) => void;
  onRemove: (period: number) => void;
  onClose: () => void;
}

function BellSheet({ period, bell, canRemove, onSave, onRemove, onClose }: BellSheetProps) {
  const { t } = useTranslation();
  const [last, setLast] = useState<{ period: number; bell: Bell } | null>(null);
  if (period != null && bell && (last?.period !== period || last.bell !== bell)) setLast({ period, bell });
  const target = period != null && bell ? { period, bell } : last;

  return (
    <Sheet open={period != null} onClose={onClose} title={target ? t('editor.periodN', { n: target.period + 1 }) : ''} testId="bell-sheet">
      {target && <BellForm key={target.period} {...target} canRemove={canRemove} onSave={onSave} onRemove={onRemove} />}
    </Sheet>
  );
}

function BellForm({
  period,
  bell,
  canRemove,
  onSave,
  onRemove,
}: {
  period: number;
  bell: Bell;
  canRemove: boolean;
  onSave: (period: number, bell: Bell) => void;
  onRemove: (period: number) => void;
}) {
  const { t } = useTranslation();
  const [start, setStart] = useState(bell.start);
  const [end, setEnd] = useState(bell.end);
  const valid = isValidBell({ start, end });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(period, { start, end });
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        {(
          [
            ['start', start, setStart],
            ['end', end, setEnd],
          ] as const
        ).map(([key, value, set]) => (
          <div key={key}>
            <label htmlFor={`bell-${key}`} className="mb-1 block text-caption font-semibold uppercase tracking-wide text-ink-3">
              {t(`editor.${key}`)}
            </label>
            <input
              id={`bell-${key}`}
              type="time"
              value={value}
              data-autofocus={key === 'start' ? true : undefined}
              onChange={(e) => {
                set(e.target.value);
                // Keep the lesson length when the start moves.
                if (key === 'start' && isValidBell(bell) && /^\d{2}:\d{2}$/.test(e.target.value)) {
                  setEnd(formatHm(parseHm(e.target.value) + parseHm(bell.end) - parseHm(bell.start)));
                }
              }}
              className="tabular w-full rounded-md bg-surface-2 px-4 py-3 text-lead text-ink"
            />
          </div>
        ))}
      </div>
      {!valid && <p className="text-small text-danger">{t('editor.invalidTimes')}</p>}
      <div className="flex items-center gap-2 pt-2">
        {canRemove && (
          <Button variant="danger" icon="trash" onClick={() => onRemove(period)}>
            {t('editor.removePeriod')}
          </Button>
        )}
        <Button type="submit" variant="primary" size="lg" className="flex-1" disabled={!valid}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

