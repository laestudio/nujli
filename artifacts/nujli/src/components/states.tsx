import type { ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errMsg, errStatus } from '@/lib/format';
import type { ClaimLabel, ProjectStatus } from '@workspace/api-client-react';

export function Block({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-paper-3/70', className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14 space-y-6" aria-busy="true" aria-label="Loading">
      <Block className="h-3 w-32" />
      <Block className="h-12 w-3/4" />
      <Block className="h-4 w-1/2" />
      <div className="grid gap-4 md:grid-cols-[2fr_1fr] pt-6">
        <Block className="h-64" />
        <Block className="h-64" />
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'The server returned an error.' }: { error: unknown; onRetry?: () => void; title?: string }) {
  const status = errStatus(error);
  return (
    <div role="alert" className="border border-vermilion/50 bg-vermilion/5 p-5 rounded-md" data-testid="state-error">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-vermilion-deep shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold">{title}</p>
          <p className="mt-1 text-sm text-foreground/80 break-words">{errMsg(error)}</p>
          {status !== null && <p className="meta mt-2 text-foreground/60">HTTP {status}</p>}
        </div>
        {onRetry && (
          <button onClick={onRetry} data-testid="button-retry" className="inline-flex items-center gap-1.5 text-sm font-medium border border-ink/20 px-3 py-1.5 rounded-sm hover:bg-ink hover:text-paper transition-colors">
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function Empty({ kicker, title, children, action, dark }: { kicker?: string; title: string; children?: ReactNode; action?: ReactNode; dark?: boolean }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md border border-dashed p-8 md:p-10', dark ? 'border-paper/20 text-paper' : 'border-ink/25')} data-testid="state-empty">
      <div aria-hidden className="absolute right-6 top-6 grid grid-cols-6 gap-1.5 opacity-40">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className={cn('h-1 w-1 rounded-full', i === 9 ? 'bg-vermilion' : dark ? 'bg-paper/40' : 'bg-ink/30')} />
        ))}
      </div>
      {kicker && <p className={cn('meta', dark ? 'text-paper/60' : 'text-foreground/60')}>{kicker}</p>}
      <h3 className="mt-2 font-display text-xl md:text-2xl font-semibold max-w-lg">{title}</h3>
      {children && <div className={cn('mt-2 text-sm max-w-lg leading-relaxed', dark ? 'text-paper/70' : 'text-foreground/70')}>{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ClaimLabelBadge({ label }: { label: ClaimLabel }) {
  const styles: Record<string, string> = {
    'Organization Reported': 'border-ink/30 text-ink bg-paper',
    Corroborated: 'border-ink bg-ink text-paper',
    'Independently Reviewed': 'border-vermilion bg-vermilion text-white',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 border px-2 py-0.5 rounded-sm font-mono text-[0.68rem] tracking-wide uppercase whitespace-nowrap', styles[label] ?? styles['Organization Reported'])} data-testid="badge-claim-label">
      {label}
    </span>
  );
}

export function StatusPill({ status }: { status: ProjectStatus }) {
  const map: Record<string, string> = {
    draft: 'border-ink/30 text-ink',
    approved: 'border-ink bg-ink text-paper',
    published: 'border-vermilion-deep text-vermilion-deep',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 border px-2 py-0.5 rounded-sm meta', map[status])} data-testid={`status-${status}`}>
      {status === 'published' && <span className="h-1.5 w-1.5 rounded-full bg-vermilion" />}
      {status}
    </span>
  );
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('meta flex items-center gap-2', className)}><span className="h-1.5 w-1.5 rounded-full bg-vermilion" />{children}</p>;
}
