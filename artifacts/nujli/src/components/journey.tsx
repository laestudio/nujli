import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const STAGES = ['Choose', 'Pay', 'Generate', 'Review', 'Publish'] as const;
export type Stage = (typeof STAGES)[number];

/** Five-stage organization journey indicator. `current` is the active stage. */
export function Journey({ current, dark, className }: { current: Stage; dark?: boolean; className?: string }) {
  const idx = STAGES.indexOf(current);
  return (
    <nav aria-label="Your progress" className={cn('w-full', className)} data-testid="journey">
      <ol className="grid grid-cols-5 gap-1.5 sm:gap-3">
        {STAGES.map((s, i) => {
          const done = i < idx;
          const now = i === idx;
          return (
            <li key={s} className="min-w-0" aria-current={now ? 'step' : undefined} data-testid={`journey-stage-${s.toLowerCase()}`}>
              <span className={cn('block h-[3px] rounded-full transition-colors', done ? (dark ? 'bg-paper' : 'bg-ink') : now ? 'bg-vermilion' : dark ? 'bg-paper/15' : 'bg-ink/12')} />
              <span className={cn('mt-2 flex items-center gap-1 meta truncate !text-[0.62rem] sm:!text-[0.72rem]',
                now ? (dark ? 'text-paper' : 'text-ink') : done ? (dark ? 'text-paper/70' : 'text-ink/70') : dark ? 'text-paper/40' : 'text-ink/40')}>
                {done && <Check className="hidden sm:inline h-3 w-3 shrink-0" aria-hidden />}
                <span className="truncate">{s}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Plain-language mapping of server generation statuses. */
export const GEN_STEPS = [
  { key: 'queued', label: 'Waiting to start' },
  { key: 'fetching', label: 'Reading your project' },
  { key: 'generating', label: 'Organizing your evidence' },
  { key: 'building', label: 'Building your experience' },
  { key: 'preparing', label: 'Preparing your preview' },
] as const;

export const ACTIVE_GEN = ['queued', 'fetching', 'generating', 'building', 'preparing'];

export function genLabel(status?: string | null): string {
  if (!status) return 'Not started';
  if (status === 'completed') return 'Your preview is ready';
  if (status === 'failed') return 'Generation stopped';
  if (status === 'idle') return 'Not started';
  return GEN_STEPS.find((s) => s.key === status)?.label ?? 'Working';
}
