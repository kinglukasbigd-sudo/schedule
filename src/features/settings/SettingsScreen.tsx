import { m } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { ScreenHeader, SectionLabel } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { eraseEverything, exportBackup, parseBackup, restoreBackup, type Backup } from '@/db/backup';
import { useSubjects } from '@/db/hooks';
import { ACCENTS, LANGUAGES, THEMES, type Accent } from '@/domain/types';
import { LANGUAGE_NAMES } from '@/i18n';
import { cx } from '@/lib/cx';
import { press } from '@/lib/motion';
import { useSettings } from '@/state/settings';
import { useUI } from '@/state/ui';

export function SettingsScreen() {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const hydrate = useSettings((s) => s.hydrate);
  const back = useUI((s) => s.back);
  const push = useUI((s) => s.push);
  const openSheet = useUI((s) => s.openSheet);
  const showToast = useUI((s) => s.showToast);
  const { list: subjects } = useSubjects();
  const importInput = useRef<HTMLInputElement>(null);
  const [confirmErase, setConfirmErase] = useState(false);

  useEffect(() => {
    if (!confirmErase) return;
    const timer = setTimeout(() => setConfirmErase(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmErase]);

  /** Replace all data, keeping a snapshot so the change can be undone. */
  const replaceAll = async (next: Backup | null, message: string) => {
    const snapshot = await exportBackup();
    if (next) await restoreBackup(next);
    else await eraseEverything();
    await hydrate();
    showToast({
      message,
      action: {
        label: t('common.undo'),
        run: () => void restoreBackup(snapshot).then(hydrate),
      },
    });
  };

  const onExport = async () => {
    const backup = await exportBackup();
    const name = `term-backup-${backup.exportedAt.slice(0, 10)}.json`;
    const file = new File([JSON.stringify(backup, null, 2)], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return;
      } catch {
        // Share sheet dismissed or unavailable: fall back to a download.
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast({ message: t('settings.exported') });
  };

  const onImport = async (file: File) => {
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      await replaceAll(backup, t('settings.imported'));
    } catch {
      showToast({ message: t('settings.importFailed') });
    }
  };

  return (
    <>
      <ScreenHeader
        title={t('settings.title')}
        leading={<IconButton icon="chevronLeft" label={t('common.back')} onClick={back} />}
      />
      <div className="flex flex-col gap-8">
        <Group label={t('settings.appearance')}>
          <div className="flex flex-col gap-4 p-4">
            <Segmented
              label={t('settings.theme')}
              value={settings.theme}
              onChange={(theme) => update({ theme })}
              options={THEMES.map((v) => ({ value: v, label: t(`settings.themes.${v}`) }))}
            />
            <div>
              <p id="accent-label" className="mb-2 text-small font-medium text-ink-2">
                {t('settings.accent')}
              </p>
              <div role="radiogroup" aria-labelledby="accent-label" className="grid grid-cols-8 gap-1">
                {ACCENTS.map((a) => (
                  <AccentSwatch key={a} accent={a} selected={settings.accent === a} onSelect={() => update({ accent: a })} />
                ))}
              </div>
            </div>
          </div>
        </Group>

        <Group label={t('settings.language')}>
          <div className="p-4">
            <Segmented
              label={t('settings.language')}
              value={settings.language}
              onChange={(language) => update({ language })}
              options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))}
            />
          </div>
        </Group>

        <Group label={t('settings.timetable')}>
          <NavRow icon="grid" label={t('settings.editTimetable')} onClick={() => push({ name: 'timetable' })} />
          <NavRow icon="camera" label={t('settings.importAgain')} onClick={() => push({ name: 'setup' })} />
        </Group>

        <Group label={t('settings.subjects')}>
          {subjects.length === 0 ? (
            <p className="p-4 text-small text-ink-2">{t('settings.noSubjects')}</p>
          ) : (
            subjects.map((s) => (
              <NavRow
                key={s.id}
                label={s.name}
                leading={
                  <span className={`subject-${s.color} flex h-6 w-6 items-center justify-center`}>
                    <span className="h-3 w-3 rounded-full bg-subj-dot" />
                  </span>
                }
                onClick={() => openSheet({ type: 'subject', subjectId: s.id })}
              />
            ))
          )}
        </Group>

        <Group label={t('settings.data')}>
          <NavRow icon="download" label={t('settings.export')} onClick={() => void onExport()} />
          <NavRow icon="upload" label={t('settings.import')} onClick={() => importInput.current?.click()} />
          <NavRow
            icon="trash"
            danger
            label={confirmErase ? t('settings.eraseConfirm') : t('settings.erase')}
            onClick={() => {
              if (!confirmErase) return setConfirmErase(true);
              setConfirmErase(false);
              void replaceAll(null, t('settings.erased'));
            }}
          />
        </Group>

        <p className="pb-4 text-center text-caption text-ink-3">{t('settings.footer', { version: __APP_VERSION__ })}</p>
      </div>
      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void onImport(file);
        }}
      />
    </>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <div className="divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-card">{children}</div>
    </section>
  );
}

function NavRow({
  icon,
  leading,
  label,
  onClick,
  danger,
}: {
  icon?: IconName;
  leading?: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-body transition-colors duration-fast hover:bg-surface-2',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      {leading ?? (icon && <Icon name={icon} size={20} className={danger ? 'text-danger' : 'text-ink-2'} />)}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!danger && <Icon name="chevronRight" size={16} className="text-ink-3" />}
    </button>
  );
}

function AccentSwatch({ accent, selected, onSelect }: { accent: Accent; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  return (
    <m.button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={t(`accents.${accent}`)}
      {...press}
      onClick={onSelect}
      data-accent={accent}
      className="flex h-11 items-center justify-center"
    >
      <span
        className={cx(
          'flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-fg',
          selected && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
        )}
      >
        {selected && <Icon name="check" size={16} strokeWidth={2.5} />}
      </span>
    </m.button>
  );
}
