import type { Subject, TaskKind } from '@/domain/types';
import { cx } from '@/lib/cx';
import { useTranslation } from 'react-i18next';

/** Pastel dot + subject name, the standard way to show a subject inline. */
export function SubjectTag({ subject, className }: { subject: Subject | undefined; className?: string }) {
  if (!subject) return null;
  return (
    <span className={cx(`subject-${subject.color} inline-flex min-w-0 items-center gap-1`, className)}>
      <span className="h-2 w-2 shrink-0 rounded-full bg-subj-dot" aria-hidden="true" />
      <span className="truncate">{subject.name}</span>
    </span>
  );
}

/** Tests and assignments get a label; homework is the default and stays quiet. */
export function KindBadge({ kind }: { kind: TaskKind }) {
  const { t } = useTranslation();
  if (kind === 'homework') return null;
  return (
    <span
      className={cx(
        'inline-flex h-5 shrink-0 items-center rounded-xs px-1 text-caption font-semibold',
        kind === 'test' ? 'bg-ink text-bg' : 'bg-surface-3 text-ink',
      )}
    >
      {t(`kind.${kind}`)}
    </span>
  );
}
