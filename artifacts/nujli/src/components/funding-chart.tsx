import { useMemo, useState } from 'react';
import { BarChart3, FileText, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KIND_EXPLAIN, KIND_LABEL, entryDate, fmtAmount, fmtDay, type FinancialEntry, type FinancialKind } from '@/lib/financial';

export interface ChartEntry { id: string; entry: FinancialEntry }
type Mode = 'chart' | 'table' | 'text';

const ORDER: FinancialKind[] = ['spent', 'received', 'transferred', 'budget', 'reported'];

export function ModeSwitch<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { v: T; label: string; icon: React.ReactNode }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-md border border-ink/25 overflow-hidden">
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)} className={cn('min-h-11 px-3 inline-flex items-center gap-1.5 text-sm font-medium border-r last:border-r-0 border-ink/25', value === o.v ? 'bg-ink text-paper' : 'hover:bg-ink/5')} data-testid={`button-mode-${o.v}`}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

export function FundingChart({ entries, onOpen }: { entries: ChartEntry[]; onOpen: (id: string) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, ChartEntry[]>();
    for (const c of entries) {
      const k = `${c.entry.kind}|${c.entry.currency || 'none'}`;
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return [...m.entries()].sort((a, b) => ORDER.indexOf(a[0].split('|')[0] as FinancialKind) - ORDER.indexOf(b[0].split('|')[0] as FinancialKind));
  }, [entries]);
  const [key, setKey] = useState(() => groups[0]?.[0] ?? '');
  const [mode, setMode] = useState<Mode>('chart');
  if (groups.length === 0) return null;
  const active = groups.find((g) => g[0] === key) ?? groups[0];
  const [kind, currency] = active[0].split('|') as [FinancialKind, string];
  const all = [...active[1]].sort((a, b) => (entryDate(a.entry) ?? '').localeCompare(entryDate(b.entry) ?? '') || a.id.localeCompare(b.id));
  const plotted = all.filter((c) => entryDate(c.entry) && c.entry.amount !== null);
  const skipped = all.length - plotted.length;
  const dateName = kind === 'budget' ? 'budget period start' : 'transaction date';
  const cur = currency === 'none' ? '' : currency;
  const c0 = cur;
  const maxV = Math.max(0, ...plotted.map((c) => c.entry.amount!));
  const minV = Math.min(0, ...plotted.map((c) => c.entry.amount!));
  const range = maxV - minV || 1;
  // Signed scale: zero sits where the data range puts it. Label area reserved for text.
  const zeroPct = (-minV / range) * 100;
  const labelInside = (v: number) => (v >= 0 ? zeroPct + (v / range) * 100 > 70 : zeroPct - (-v / range) * 100 < 30);
  const labelPos = (v: number, w: number): React.CSSProperties => labelInside(v)
    ? (v >= 0 ? { right: `${100 - zeroPct - w}%` } : { left: `${zeroPct - w}%` })
    : (v >= 0 ? { left: `${zeroPct + w}%` } : { right: `${100 - zeroPct + w}%` });
  const summary = plotted.length === 0
    ? `No dated ${KIND_LABEL[kind].toLowerCase()} entries can be plotted.`
    : `${plotted.length} separate ${KIND_LABEL[kind].toLowerCase()} entr${plotted.length === 1 ? 'y' : 'ies'} in ${cur || 'unstated currency'}, by ${dateName}, from ${fmtDay(entryDate(plotted[0].entry))} to ${fmtDay(entryDate(plotted[plotted.length - 1].entry))}. Each bar is one reported entry; bars are not added together. ` +
      plotted.map((c) => `${fmtDay(entryDate(c.entry))}: ${fmtAmount(c.entry.amount, c.entry.currency, c.entry.rawAmount)}`).join('; ') + '.';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div className="min-w-0 max-w-full">
          <label htmlFor="funding-type" className="block text-sm font-semibold">Show one type at a time</label>
          <select id="funding-type" value={active[0]} onChange={(e) => setKey(e.target.value)} className="mt-1 min-h-11 w-full max-w-full min-w-0 rounded-md border border-ink/40 bg-paper px-3 text-sm" data-testid="select-funding-type">
            {groups.map(([k, list]) => { const [kd, c] = k.split('|'); return <option key={k} value={k}>{KIND_LABEL[kd as FinancialKind]} ({c === 'none' ? 'no currency' : c}), {list.length} entr{list.length === 1 ? 'y' : 'ies'}</option>; })}
          </select>
        </div>
        <ModeSwitch label="Funding view" value={mode} onChange={(v) => { if (v === 'chart' || v === 'table' || v === 'text') setMode(v); }} options={[
          { v: 'chart', label: 'Chart', icon: <BarChart3 className="h-4 w-4" aria-hidden /> },
          { v: 'table', label: 'Table', icon: <Table2 className="h-4 w-4" aria-hidden /> },
          { v: 'text', label: 'Read as text', icon: <FileText className="h-4 w-4" aria-hidden /> },
        ]} />
      </div>
      <p className="text-sm text-ink/80 max-w-3xl">{KIND_EXPLAIN[kind]} {kind === 'budget' && 'Budgets are never mixed with transactions here.'}</p>

      {mode === 'chart' && (
        <figure className="min-w-0 rounded-md border border-ink/15 p-4 pt-3">
          <figcaption className="text-sm font-semibold">{KIND_LABEL[kind]}, one row per reported entry, ordered by {dateName} <span className="font-normal text-ink/75">· amount in {cur || 'currency not reported'}</span></figcaption>
          {plotted.length === 0 ? <p className="mt-4 text-sm">{summary}</p> : (
            <div className="mt-4 max-w-full overflow-x-auto" role="group" aria-label={`Chart. ${summary} Each row is a button that opens its source.`}>
              <div className="grid grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)] gap-x-3 text-[0.7rem] font-mono text-ink/80" aria-hidden>
                <span>{dateName[0].toUpperCase() + dateName.slice(1)}</span>
                <div className="relative h-5">
                  <span className="absolute -translate-x-1/2" style={{ left: `${zeroPct}%` }}>0</span>
                  {minV < 0 && <span className="absolute left-0">{fmtAmount(minV, c0)}</span>}
                  {maxV > 0 && <span className="absolute right-0">{fmtAmount(maxV, c0)}</span>}
                </div>
              </div>
              <ol className="mt-1">
                {plotted.map((c, i) => {
                  const v = c.entry.amount!; const d = entryDate(c.entry)!;
                  const same = plotted.filter((x) => entryDate(x.entry) === d);
                  const nth = same.indexOf(c) + 1;
                  const w = (Math.abs(v) / range) * 100;
                  return (
                    <li key={c.id}>
                      <button type="button" onClick={() => onOpen(c.id)} data-testid={`button-bar-${c.id}`}
                        aria-label={`${KIND_LABEL[kind]}, ${dateName} ${fmtDay(d)}${same.length > 1 ? `, entry ${nth} of ${same.length} on this date` : ''}: ${fmtAmount(v, c.entry.currency, c.entry.rawAmount)}. Open source`}
                        className={cn('group grid w-full min-h-11 grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)] items-center gap-x-3 text-left hover:bg-ink/5 focus-visible:bg-ink/5', i > 0 && 'border-t border-ink/10')}>
                        <span className="text-xs font-mono" aria-hidden>{fmtDay(d)}{same.length > 1 && <span className="block text-ink/75">{nth} of {same.length}</span>}</span>
                        <span className="relative block h-11" aria-hidden>
                          <span className="absolute inset-y-0 border-l-2 border-ink" style={{ left: `${zeroPct}%` }} />
                          <span className={cn('absolute top-1/2 h-5 -translate-y-1/2 forced-bar', v < 0 ? 'bg-ink bar-neg' : 'bg-vermilion-deep group-hover:bg-ink')} style={{ left: `${v < 0 ? zeroPct - w : zeroPct}%`, width: `${w}%` }} />
                        </span>
                        <span className="col-span-2 min-w-0 pb-2 text-right text-xs font-mono text-ink [overflow-wrap:anywhere]" aria-hidden>{fmtAmount(v, c.entry.currency, c.entry.rawAmount)}{v < 0 && ' (negative)'}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-[0.7rem] font-mono text-ink/80" aria-hidden>Amount ({cur || 'currency not reported'}) from the 0 baseline →</p>
            </div>
          )}
          <p className="mt-3 text-xs text-ink/80">Each row is one reported entry; entries sharing a date get their own rows. Bars start at zero{minV < 0 ? '; negative amounts extend left of zero and are marked "negative"' : ''}. Nothing is filled in or added together. Select a row to open its source.</p>
        </figure>
      )}

      {mode === 'text' && <p className="max-w-3xl leading-relaxed" data-testid="text-funding-summary">{summary}</p>}

      {mode === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm stack-table">
            <caption className="sr-only">{KIND_LABEL[kind]} entries in {cur || 'unstated currency'}</caption>
            <thead><tr className="text-left border-b border-ink/30"><th scope="col" className="py-2 pr-3">{kind === 'budget' ? 'Period' : 'Transaction date'}</th><th scope="col" className="py-2 pr-3">Value date</th><th scope="col" className="py-2 pr-3">Amount</th><th scope="col" className="py-2 pr-3">Label as published</th><th scope="col" className="py-2"><span className="sr-only">Source</span></th></tr></thead>
            <tbody>
              {all.map((c) => (
                <tr key={c.id} className="border-b border-ink/10 align-top">
                  <td data-label={kind === 'budget' ? 'Period' : 'Transaction date'} className="py-2 pr-3">{kind === 'budget' ? `${fmtDay(c.entry.periodStart)} to ${fmtDay(c.entry.periodEnd)}` : fmtDay(c.entry.transactionDate)}</td>
                  <td data-label="Value date" className="py-2 pr-3">{fmtDay(c.entry.valueDate)}</td>
                  <td data-label="Amount" className="py-2 pr-3 font-mono">{fmtAmount(c.entry.amount, c.entry.currency, c.entry.rawAmount)}</td>
                  <td data-label="Label as published" className="py-2 pr-3">{c.entry.ref ?? KIND_LABEL[kind]}</td>
                  <td className="py-1"><button type="button" onClick={() => onOpen(c.id)} className="min-h-11 text-sm font-medium underline underline-offset-2" data-testid={`button-funding-source-${c.id}`}>Source</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {skipped > 0 && <p className="text-xs text-ink/75">{skipped} entr{skipped === 1 ? 'y has' : 'ies have'} no {dateName} or no numeric amount and {skipped === 1 ? 'is' : 'are'} listed only in the table.</p>}
    </div>
  );
}
