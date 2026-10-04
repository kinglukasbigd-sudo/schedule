import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
  /** When the empty state is a section of its own, its title is that section's heading. */
  heading?: { level: 'h2' | 'h3'; id: string };
}

export function EmptyState({ icon, title, body, action, heading }: EmptyStateProps) {
  const Title = heading?.level ?? 'p';
  return (
    <div className="flex flex-col items-center px-6 py-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon name={icon} />
      </div>
      <Title id={heading?.id} className="text-lead font-semibold text-ink">
        {title}
      </Title>
      <p className="mt-1 max-w-xs text-small text-ink-2">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
