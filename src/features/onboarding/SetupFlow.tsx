import { AnimatePresence, m } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { Segmented } from '@/components/Segmented';
import { useSubjects } from '@/db/hooks';
import { applyDraft } from '@/db/repo';
import { defaultBells } from '@/domain/schedule';
import { LANGUAGES, type DraftTimetable, type Weekday } from '@/domain/types';
import { TimetableEditor } from '@/features/timetable/TimetableEditor';
import { LANGUAGE_NAMES } from '@/i18n';
import type { ImportPhase } from '@/import';
import { cx } from '@/lib/cx';
import { useFormat } from '@/lib/format';
import { press, spring } from '@/lib/motion';
import { useSettings } from '@/state/settings';
import { useUI } from '@/state/ui';
import { addDays, startOfISOWeek } from 'date-fns';

type Step =
  | { name: 'welcome' }
  | { name: 'method'; error?: 'unsupported' | 'no-timetable' | 'failed' }
  | { name: 'type' }
  | { name: 'importing'; file: File }
  | { name: 'review'; draft: DraftTimetable; from: 'type' | 'method' };

interface SetupFlowProps {
  /** First run starts with the welcome screen; adding later starts at the method choice. */
  firstRun: boolean;
  onDone: () => void;
  onCancel?: () => void;
}

const WORK_DAYS: Weekday[] = [1, 2, 3, 4, 5];

export function SetupFlow({ firstRun, onDone, onCancel }: SetupFlowProps) {
  const [step, setStep] = useState<Step>(firstRun ? { name: 'welcome' } : { name: 'method' });
  const [fields, setFields] = useState<Partial<Record<Weekday, string>>>({});
  const [direction, setDirection] = useState(1);
  const update = useSettings((s) => s.update);

  const go = (next: Step, dir = 1) => {
    setDirection(dir);
    setStep(next);
  };

  const finish = async (draft: DraftTimetable | null) => {
    if (draft) await applyDraft(draft);
    update({ onboarded: true });
    onDone();
  };

  let content: ReactNode;
  switch (step.name) {
    case 'welcome':
      content = <Welcome onStart={() => go({ name: 'method' })} onSkip={() => void finish(null)} />;
      break;
    case 'method':
      content = (
        <Method
          error={step.error}
          onBack={firstRun ? () => go({ name: 'welcome' }, -1) : onCancel}
          onFile={(file) => go({ name: 'importing', file })}
          onType={() => go({ name: 'type' })}
        />
      );
      break;
    case 'type':
      content = (
        <TypeIn
          fields={fields}
          onFields={setFields}
          onBack={() => go({ name: 'method' }, -1)}
          onDraft={(draft) => go({ name: 'review', draft, from: 'type' })}
        />
      );
      break;
    case 'importing':
      content = (
        <Importing
          file={step.file}
          onCancel={() => go({ name: 'method' }, -1)}
          onError={(error) => go({ name: 'method', error }, -1)}
          onDraft={(draft) => go({ name: 'review', draft, from: 'method' })}
        />
      );
      break;
    case 'review':
      content = (
        <Review
          draft={step.draft}
          onChange={(draft) => setStep({ ...step, draft })}
          onBack={() => go({ name: step.from }, -1)}
          onConfirm={() => void finish(step.draft)}
        />
      );
      break;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-content flex-col px-4" data-testid={`setup-${step.name}`}>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <m.div
          key={step.name}
          initial={{ opacity: 0, x: direction * 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -32 }}
          transition={spring.gentle}
          className="flex flex-1 flex-col"
        >
          {content}
        </m.div>
      </AnimatePresence>
    </div>
  );
}

function TopBar({ onBack, right }: { onBack?: (() => void) | undefined; right?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="pt-safe flex h-14 items-center justify-between">
      {onBack ? <IconButton icon="chevronLeft" label={t('common.back')} onClick={onBack} className="-ml-2" /> : <span />}
      {right}
    </div>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return <div className="pb-safe sticky bottom-0 -mx-4 mt-auto bg-bg px-4 pt-4">{children}</div>;
}

function Welcome({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const { t } = useTranslation();
  const language = useSettings((s) => s.settings.language);
  const update = useSettings((s) => s.update);
  return (
    <>
      <TopBar
        right={
          <Segmented
            label={t('settings.language')}
            value={language}
            onChange={(language) => update({ language })}
            options={LANGUAGES.map((l) => ({ value: l, label: l.toUpperCase(), ariaLabel: LANGUAGE_NAMES[l] }))}
            className="w-40"
          />
        }
      />
      <div className="flex flex-1 flex-col justify-center py-10">
        <div
          className="mb-8 flex h-16 w-16 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-fab"
          aria-hidden="true"
        >
          <Icon name="today" size={32} strokeWidth={2} />
        </div>
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-3">TERM</p>
        <h1 className="mt-2 text-display font-bold text-ink">{t('onboarding.welcomeTitle')}</h1>
        <p className="mt-4 max-w-sm text-lead text-ink-2">{t('onboarding.welcomeBody')}</p>
      </div>
      <Footer>
        <Button variant="primary" size="lg" block onClick={onStart} data-testid="start">
          {t('onboarding.start')}
        </Button>
        <Button variant="ghost" block onClick={onSkip} className="mt-2">
          {t('onboarding.skip')}
        </Button>
      </Footer>
    </>
  );
}

function OptionCard({
  icon,
  title,
  body,
  onClick,
  primary,
  testId,
}: {
  icon: IconName;
  title: string;
  body: string;
  onClick: () => void;
  primary?: boolean;
  testId: string;
}) {
  return (
    <m.button
      type="button"
      {...press}
      onClick={onClick}
      data-testid={testId}
      className="flex w-full items-center gap-4 rounded-lg bg-surface p-4 text-left shadow-card transition-colors duration-fast hover:bg-surface-2"
    >
      <span
        className={cx(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-md',
          primary ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-ink',
        )}
      >
        <Icon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lead font-semibold text-ink">{title}</span>
        <span className="block text-small text-ink-2">{body}</span>
      </span>
      <Icon name="chevronRight" size={20} className="text-ink-3" />
    </m.button>
  );
}

function Method({
  error,
  onBack,
  onFile,
  onType,
}: {
  error: 'unsupported' | 'no-timetable' | 'failed' | undefined;
  onBack: (() => void) | undefined;
  onFile: (file: File) => void;
  onType: () => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <TopBar onBack={onBack} />
      <h1 className="text-large font-semibold text-ink">{t('onboarding.methodTitle')}</h1>
      <p className="mt-1 text-body text-ink-2">{t('onboarding.methodBody')}</p>
      {error && (
        <div role="alert" className="mt-6 flex gap-3 rounded-lg bg-danger-soft p-4 text-small text-ink">
          <Icon name="alert" size={20} className="shrink-0 text-danger" />
          <span>{t(`onboarding.error.${error}`)}</span>
        </div>
      )}
      <div className="mt-8 flex flex-col gap-3">
        <OptionCard
          primary
          icon="camera"
          title={t('onboarding.scanTitle')}
          body={t('onboarding.scanBody')}
          onClick={() => input.current?.click()}
          testId="method-scan"
        />
        <OptionCard
          icon="keyboard"
          title={t('onboarding.typeTitle')}
          body={t('onboarding.typeBody')}
          onClick={onType}
          testId="method-type"
        />
      </div>
      <p className="mt-6 flex items-center gap-2 text-small text-ink-3">
        <Icon name="check" size={16} />
        {t('onboarding.private')}
      </p>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </>
  );
}

function TypeIn({
  fields,
  onFields,
  onBack,
  onDraft,
}: {
  fields: Partial<Record<Weekday, string>>;
  onFields: (f: Partial<Record<Weekday, string>>) => void;
  onBack: () => void;
  onDraft: (draft: DraftTimetable) => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const monday = startOfISOWeek(new Date());
  const [days, setDays] = useState<Weekday[]>(() =>
    fields[6] || fields[7] ? [...WORK_DAYS, 6, ...(fields[7] ? [7 as Weekday] : [])] : WORK_DAYS,
  );
  const [error, setError] = useState(false);
  const filled = days.some((d) => fields[d]?.trim());

  const submit = async () => {
    const { parseDayFields } = await import('@/import/text');
    const draft = parseDayFields(Object.fromEntries(days.map((d) => [d, fields[d] ?? ''])));
    if (!draft) return setError(true);
    onDraft(draft);
  };

  // Pasting a whole timetable into any field skips straight to review.
  const onPaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n')) return;
    e.preventDefault();
    const { parseTimetableText } = await import('@/import/text');
    const draft = parseTimetableText(text);
    if (draft) onDraft(draft);
    else setError(true);
  };

  return (
    <>
      <TopBar onBack={onBack} />
      <h1 className="text-large font-semibold text-ink">{t('onboarding.typeHeading')}</h1>
      <p className="mt-1 text-body text-ink-2">{t('onboarding.typeHint')}</p>
      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {days.map((d, i) => {
          const name = f.weekday(addDays(monday, d - 1));
          return (
            <div key={d}>
              <label htmlFor={`day-${d}`} className="mb-1 block text-small font-medium text-ink-2">
                {name}
              </label>
              <GrowingField
                id={`day-${d}`}
                data-testid={`day-${d}`}
                value={fields[d] ?? ''}
                autoFocus={i === 0}
                onChange={(e) => {
                  setError(false);
                  onFields({ ...fields, [d]: e.target.value.replace(/\n/g, ', ') });
                }}
                onPaste={(e) => void onPaste(e)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const next = document.getElementById(`day-${days[i + 1]}`);
                    if (next) next.focus();
                    else if (filled) void submit();
                  }
                }}
                placeholder={i === 0 ? t('onboarding.typePlaceholder') : ''}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint={i === days.length - 1 ? 'done' : 'next'}
              />
            </div>
          );
        })}
        {!days.includes(6) && (
          <Button variant="ghost" icon="plus" onClick={() => setDays([...days, 6])} className="-ml-2 self-start">
            {t('onboarding.addSaturday')}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-small text-danger">
            {t('onboarding.typeError')}
          </p>
        )}
        <Footer>
          <Button type="submit" variant="primary" size="lg" block disabled={!filled} data-testid="type-continue">
            {t('common.continue')}
          </Button>
        </Footer>
      </form>
    </>
  );
}

/** A text field that grows with its content, so a long school day stays readable. */
function GrowingField(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { 'data-testid'?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      {...props}
      className="block w-full resize-none overflow-hidden rounded-md bg-surface px-4 py-3 text-body text-ink shadow-card placeholder:text-ink-3"
    />
  );
}

function Importing({
  file,
  onCancel,
  onError,
  onDraft,
}: {
  file: File;
  onCancel: () => void;
  onError: (code: 'unsupported' | 'no-timetable' | 'failed') => void;
  onDraft: (draft: DraftTimetable) => void;
}) {
  const { t } = useTranslation();
  const language = useSettings((s) => s.settings.language);
  const announce = useUI((s) => s.announce);
  const [phase, setPhase] = useState<ImportPhase>('reading');
  const [progress, setProgress] = useState(0);
  const handlers = useRef({ onError, onDraft });
  useEffect(() => {
    handlers.current = { onError, onDraft };
  });

  useEffect(() => {
    const controller = new AbortController();
    let lastPhase: ImportPhase | null = null;
    void (async () => {
      try {
        const { importTimetableFile, ImportError } = await import('@/import');
        try {
          const draft = await importTimetableFile(
            file,
            language,
            (p, fraction) => {
              if (controller.signal.aborted) return;
              if (p !== lastPhase) {
                lastPhase = p;
                announce(t(`onboarding.phase.${p}`));
              }
              setPhase(p);
              setProgress(fraction);
            },
            controller.signal,
          );
          if (!controller.signal.aborted) handlers.current.onDraft(draft);
        } catch (err) {
          if (controller.signal.aborted) return;
          handlers.current.onError(err instanceof ImportError ? err.code : 'failed');
        }
      } catch {
        if (!controller.signal.aborted) handlers.current.onError('failed');
      }
    })();
    return () => controller.abort();
  }, [file, language, announce, t]);

  const pct = Math.round(progress * 100);
  return (
    <>
      <TopBar />
      <div className="flex flex-1 flex-col items-center justify-center text-center" aria-busy="true">
        <m.div
          className="mb-8 flex h-16 w-16 items-center justify-center rounded-xl bg-accent-soft text-accent"
          animate={{ rotate: [0, 6, -6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          <Icon name={file.type === 'application/pdf' ? 'upload' : 'camera'} size={32} />
        </m.div>
        <h1 className="text-title font-semibold text-ink">{t(`onboarding.phase.${phase}`)}</h1>
        <div
          className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-label={t(`onboarding.phase.${phase}`)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={phase === 'recognizing' ? pct : undefined}
        >
          <m.div
            className="h-1 origin-left rounded-full bg-accent"
            initial={{ scaleX: 0.05 }}
            animate={{ scaleX: phase === 'arranging' ? 1 : phase === 'recognizing' ? Math.max(0.1, progress) : 0.08 }}
            transition={spring.gentle}
          />
        </div>
        <p className="mt-4 max-w-xs text-small text-ink-3">{t('onboarding.onDevice')}</p>
      </div>
      <Footer>
        <Button variant="ghost" block onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </Footer>
    </>
  );
}

function Review({
  draft,
  onChange,
  onBack,
  onConfirm,
}: {
  draft: DraftTimetable;
  onChange: (d: DraftTimetable) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const { list } = useSubjects();
  const subjects = new Set(draft.cells.map((c) => c.subject.toLocaleLowerCase())).size;
  const safeDraft = draft.bells.length ? draft : { ...draft, bells: defaultBells() };
  return (
    <>
      <TopBar onBack={onBack} />
      <h1 className="text-large font-semibold text-ink">{t('onboarding.reviewTitle')}</h1>
      <p className="mb-6 mt-1 text-body text-ink-2" data-testid="review-summary">
        {t('onboarding.reviewBody', { lessons: draft.cells.length, subjects })}
      </p>
      <TimetableEditor draft={safeDraft} onChange={onChange} existing={list} />
      <Footer>
        <Button variant="primary" size="lg" block onClick={onConfirm} data-testid="review-confirm">
          {t('onboarding.looksGood')}
        </Button>
      </Footer>
    </>
  );
}

