import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Check, Copy, FileCode2, Info, Link2Off } from 'lucide-react';
import type { ClaimLabel } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ClaimLabelBadge } from '@/components/states';
import { cn } from '@/lib/utils';
import { hostOf } from '@/lib/format';
import type { SourceField } from '@/lib/financial';

export interface SourceTarget {
  title: string;
  valueText: string;
  unit?: string;
  dateText: string;
  originalLabel?: string;
  sourceUrl: string;
  raw?: string;
  fields?: SourceField[];
  limitations: string;
  claimLabel?: ClaimLabel;
  anchor?: string;
}

export function SourceLink({ url, className, dark }: { url: string; className?: string; dark?: boolean }) {
  if (!url) return <span className={cn('inline-flex items-center gap-1 text-sm font-medium', className)}><Link2Off className="h-4 w-4" aria-hidden />Source link missing</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className={cn('inline-flex min-h-11 items-center gap-1 font-mono text-[0.78rem] underline underline-offset-2 break-all', dark ? 'text-paper' : 'text-ink', className)} data-testid="link-source">
      {hostOf(url)} <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function useCopyLink() {
  const [msg, setMsg] = useState('');
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(t.current), []);
  const copy = async (anchor: string) => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${anchor}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('unsupported');
      await navigator.clipboard.writeText(url);
      setMsg('Link copied.');
    } catch {
      setMsg(`Could not copy automatically. Link: ${url}`);
    }
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(''), 8000);
  };
  return { msg, copy };
}

export function CopyLinkButton({ anchor, label = 'Copy link' }: { anchor: string; label?: string }) {
  const { msg, copy } = useCopyLink();
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={() => copy(anchor)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium underline-offset-2 hover:underline" data-testid={`button-copy-${anchor}`}>
        {msg.startsWith('Link copied') ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{label}
      </button>
      <span role="status" aria-live="polite" className="text-xs text-ink/75 break-all">{msg}</span>
    </span>
  );
}

export function FieldList({ fields }: { fields: SourceField[] }) {
  return (
    <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
      {fields.map((f) => (
        <div key={f.name} className="contents">
          <dt className="font-mono text-[0.75rem] uppercase tracking-wide text-ink/75 pt-0.5">{f.name}</dt>
          <dd className="break-words mb-1 sm:mb-0">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SourceSheet({ target, onClose, footer }: { target: SourceTarget | null; onClose: () => void; footer?: ReactNode }) {
  // No DialogTrigger: capture the opener ourselves and restore focus on close.
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          'bg-paper text-ink border-ink/20 max-h-[88dvh] overflow-y-auto sm:max-w-xl',
          'max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-xl',
        )}
        data-testid="dialog-source"
        onOpenAutoFocus={() => {
          const a = document.activeElement;
          opener.current = a instanceof HTMLElement && a !== document.body ? a : null;
        }}
        onCloseAutoFocus={(e) => {
          const el = opener.current;
          if (el && el.isConnected) { e.preventDefault(); el.focus(); }
          opener.current = null;
        }}
      >
        {target && (
          <>
            <div className="mx-auto -mt-2 mb-1 h-1 w-10 rounded-full bg-ink/30 sm:hidden" aria-hidden />
            <DialogTitle className="font-display text-xl pr-8">{target.title}</DialogTitle>
            <DialogDescription className="text-sm text-ink/80">Where this number comes from, exactly as saved.</DialogDescription>
            <div className="space-y-4">
              <div className="rounded-md border border-ink/15 p-3">
                <p className="font-display text-3xl font-bold tracking-tight">{target.valueText}{target.unit && <span className="ml-1 text-base font-medium text-ink/75">{target.unit}</span>}</p>
                <p className="mt-1 text-sm">{target.dateText}</p>
                {target.originalLabel && <p className="mt-1 text-sm"><span className="font-mono text-[0.75rem] uppercase tracking-wide text-ink/75 mr-2">Label as published</span>{target.originalLabel}</p>}
                {target.claimLabel && <div className="mt-2"><ClaimLabelBadge label={target.claimLabel} /></div>}
              </div>
              {target.fields && target.fields.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Source fields</h3>
                  <FieldList fields={target.fields} />
                </div>
              )}
              <p className="flex gap-2 text-sm rounded-md bg-ink/5 p-3"><Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden /><span><strong className="font-semibold">Limitations. </strong>{target.limitations}</span></p>
              <div><span className="text-sm font-semibold mr-2">Source</span><SourceLink url={target.sourceUrl} /></div>
              {target.raw && (
                <details className="rounded-md border border-ink/15">
                  <summary className="min-h-11 flex items-center gap-2 px-3 cursor-pointer text-sm font-medium"><FileCode2 className="h-4 w-4" aria-hidden />Show saved source text</summary>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all border-t border-ink/15 p-3 font-mono text-xs">{target.raw}</pre>
                </details>
              )}
              {target.anchor && <CopyLinkButton anchor={target.anchor} label="Copy link to this entry" />}
              {footer}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
