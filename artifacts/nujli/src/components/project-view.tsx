import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarClock, ChevronDown, CircleHelp, FileText, ImageOff, LayoutGrid, MapPin, MapPinOff, Table2, VideoOff, X } from 'lucide-react';
import type { Claim, Media, Project, Statistic } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { fmtDate, isoDay } from '@/lib/format';
import { ClaimLabelBadge, Empty, Kicker, StatusPill } from '@/components/states';
import { DemoNotice } from '@/components/demo-notice';
import { WorldMap, useReducedMotion } from '@/components/world-map';
import { CopyLinkButton, FieldList, SourceLink, SourceSheet, type SourceTarget } from '@/components/source-sheet';
import { FundingChart, ModeSwitch } from '@/components/funding-chart';
import { KIND_EXPLAIN, KIND_LABEL, decodeFinancial, entryDate, fmtAmount, fmtDay, type FinancialEntry, type FinancialKind } from '@/lib/financial';
import { ImmersiveViewer } from '@/components/immersive-viewer';
import { Link } from 'wouter';
import { MediaContextNote, MediaVideo } from '@/components/media-video';

const SINCE_KEY = 'nujli:last-donation';
function readSince(): string { try { return localStorage.getItem(SINCE_KEY) ?? ''; } catch { return ''; } }
function writeSince(v: string) { try { if (v) localStorage.setItem(SINCE_KEY, v); else localStorage.removeItem(SINCE_KEY); } catch { /* storage unavailable */ } }
const pubOf = (r: { publishedAt?: string | null }): string | null => isoDay(r.publishedAt ?? null);
type StatMode = 'cards' | 'table' | 'text';

/** Subtle reveal: content stays visible unless IntersectionObserver exists and motion is allowed. */
function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [state, setState] = useState<'idle' | 'pending' | 'in'>('idle');
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || typeof IntersectionObserver === 'undefined') return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight) return;
    setState('pending');
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setState('in'); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    const fallback = window.setTimeout(() => setState('in'), 4000);
    return () => { io.disconnect(); window.clearTimeout(fallback); };
  }, [reduced]);
  return <div ref={ref} data-reveal={state} className={cn('reveal', className)}>{children}</div>;
}

/** Visual-only count-up. Accessible text is always the final value. */
function CountUp({ value, text }: { value: number | null; text: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<string>(text);
  useEffect(() => {
    if (reduced || value === null || !Number.isFinite(value) || value === 0) { setShown(text); return; }
    let raf = 0; const t0 = performance.now(); const dur = 900;
    const fmt = (n: number) => text.replace(/[\d,]+(\.\d+)?/, new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n));
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      if (p >= 1) { setShown(text); return; }
      setShown(fmt(value * (1 - Math.pow(1 - p, 3))));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, text, reduced]);
  return <><span aria-hidden>{shown}</span><span className="sr-only">{text}</span></>;
}

function Section({ id, kicker, title, children, aside, intro }: { id: string; kicker: string; title: string; children: React.ReactNode; aside?: React.ReactNode; intro?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="py-10 border-t border-ink/15 scroll-mt-40">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div className="min-w-0">
            <Kicker className="text-ink/75">{kicker}</Kicker>
            <h2 id={`${id}-h`} className="mt-2 font-display text-2xl md:text-3xl font-semibold">{title}</h2>
            {intro && <div className="mt-2 max-w-3xl text-sm text-ink/80">{intro}</div>}
          </div>
          {aside}
        </div>
        {children}
      </Reveal>
    </section>
  );
}

interface Row {
  stat: Statistic;
  fin: FinancialEntry | null;
  claim?: Claim;
}

const LIMIT_FIN = 'This is one reported entry, not a total. Financial transactions are not evidence of delivered outcomes. Figures come from the publisher and have not been checked by nujli.';
const LIMIT_BUDGET = 'A budget is a plan for a period. It is not money received, transferred or spent, and is never added to transactions.';
const LIMIT_GENERIC = 'Reported by the organization and quoted from the source. nujli. has not checked this figure; the evidence label shows any review.';

function statValueText(r: Row): string {
  if (r.fin) return fmtAmount(r.fin.amount, r.fin.currency, r.fin.rawAmount);
  return r.stat.value?.trim() ? r.stat.value : 'Not reported';
}
function statUnit(r: Row): string | undefined {
  if (r.fin) return undefined;
  return r.stat.value?.trim() && r.stat.unit ? r.stat.unit : undefined;
}
function statTitle(r: Row): string { return r.fin ? r.fin.label : (r.stat.label?.trim() || 'Unlabelled figure'); }
function statDate(r: Row): string {
  if (r.fin?.kind === 'budget') return `Budget period ${fmtDay(r.fin.periodStart)} to ${fmtDay(r.fin.periodEnd)} · value date ${fmtDay(r.fin.valueDate)}`;
  if (r.fin) return `Transaction date ${fmtDay(r.fin.transactionDate)} · value date ${fmtDay(r.fin.valueDate)}`;
  return r.stat.asOf ? `As of ${fmtDay(isoDay(r.stat.asOf))}` : 'Date not reported';
}
function statLimit(r: Row): string { return r.fin?.kind === 'budget' ? LIMIT_BUDGET : r.fin ? LIMIT_FIN : LIMIT_GENERIC; }

function KindTag({ kind }: { kind: FinancialKind }) {
  return <span className="inline-flex items-center gap-1 rounded-sm border border-ink/40 px-1.5 py-0.5 font-mono text-[0.7rem] uppercase tracking-wide">{kind === 'budget' ? 'Plan' : kind === 'reported' ? 'Untranslated code' : 'Transaction'}</span>;
}

export function ProjectView({ project, preview = false }: { project: Project; preview?: boolean }) {
  const [since, setSince] = useState<string>(() => (preview ? '' : readSince()));
  const [reportedSince, setReportedSince] = useState('');
  const [evidenceOnly, setEvidenceOnly] = useState(false);
  const [openUpdate, setOpenUpdate] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Media | null>(null);
  const [openQuote, setOpenQuote] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SourceTarget | null>(null);
  const [statMode, setStatMode] = useState<StatMode>('cards');
  const [keyMode, setKeyMode] = useState<StatMode>('cards');
  const [helpOpen, setHelpOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [hiddenLink, setHiddenLink] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState(0);

  useEffect(() => {
    if (preview) return;
    writeSince(since);
  }, [since, preview]);

  const isDemo = !!project.demonstration;
  const publishedSince = (r: { publishedAt?: string | null }) => !since || (!!pubOf(r) && pubOf(r)! >= since);
  const claims = project.claims.filter(publishedSince);
  const claimById = useMemo(() => new Map<string, Claim>(project.claims.map((c) => [c.id, c])), [project.claims]);
  const rows = useMemo<Row[]>(() => project.statistics.map((s) => ({
    stat: s,
    fin: isDemo ? decodeFinancial(s.quote) : null,
    claim: claimById.get(s.claimId),
  })), [project.statistics, isDemo, claimById]);
  const visibleMedia = project.media.filter((m) => (preview || m.permissionStatus === 'approved') && publishedSince(m));
  const images = visibleMedia.filter((m) => m.type === 'image');
  const videos = visibleMedia.filter((m) => m.type === 'video');
  const updates = useMemo(() => [...project.updates].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [project.updates]);
  const updateFin = useMemo(() => new Map(updates.map((u) => [u.id, isDemo ? decodeFinancial(u.quote) ?? decodeFinancial(u.body) : null])), [updates, isDemo]);

  const isNew = (s: Statistic) => !!since && publishedSince(s);
  const filteredUpdates = updates.filter(u => publishedSince(u) && (!reportedSince || (isoDay(u.date) ?? '') >= reportedSince));
  const shownRows = rows.filter(r => publishedSince(r.stat) && (!reportedSince || (isoDay(r.stat.asOf) ?? '') >= reportedSince));
  const undatedHidden = since ? project.statistics.filter((s) => !pubOf(s)).length : 0;

  // Headline, next cards and chart all respect the donation-date filter.
  const finRows = shownRows.filter((r) => r.fin);
  const headline = useMemo<Row | null>(() => {
    const byDate = (k: FinancialKind) => finRows.filter((r) => r.fin!.kind === k && r.fin!.transactionDate).sort((a, b) => b.fin!.transactionDate!.localeCompare(a.fin!.transactionDate!))[0];
    return byDate('spent') ?? byDate('transferred') ?? byDate('received') ?? finRows[0] ?? shownRows.find((r) => r.stat.value?.trim()) ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since, reportedSince, rows]);
  const nextCards = useMemo(() => {
    const picks: Row[] = [];
    const latest = (k: FinancialKind) => finRows.filter((r) => r.fin!.kind === k).sort((a, b) => (entryDate(b.fin!) ?? '').localeCompare(entryDate(a.fin!) ?? ''))[0];
    for (const k of ['received', 'transferred', 'spent', 'budget', 'reported'] as FinancialKind[]) { const r = latest(k); if (r && r !== headline) picks.push(r); }
    for (const r of shownRows) { if (picks.length >= 5) break; if (!r.fin && r !== headline && !picks.includes(r)) picks.push(r); }
    return picks.slice(0, 5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since, reportedSince, rows, headline]);

  const openRow = useCallback((r: Row) => setSheet({
    title: statTitle(r), valueText: statValueText(r), unit: statUnit(r), dateText: statDate(r),
    originalLabel: r.stat.label, sourceUrl: r.stat.sourceUrl, raw: r.stat.quote || undefined,
    fields: r.fin?.fields ?? [{ name: 'Label as published', value: r.stat.label || 'Not reported' }, { name: 'Value', value: r.stat.value || 'Not reported' }, { name: 'Unit', value: r.stat.unit || 'Not reported' }, { name: 'As of', value: r.stat.asOf ?? 'Not reported' }],
    limitations: statLimit(r), claimLabel: r.claim?.label, anchor: `stat-${r.stat.id}`,
  }), []);
  const openById = (id: string) => { const r = rows.find((x) => x.stat.id === id); if (r) openRow(r); };

  // Deep links: #stat-ID / #update-ID restore expanded detail, independent of the saved filter.
  const applyHash = useCallback(() => {
    const h = decodeURIComponent(window.location.hash.slice(1));
    if (!h) return;
    let targetId = '';
    if (h.startsWith('stat-')) {
      const id = h.slice(5);
      const r = rows.find((x) => x.stat.id === id);
      if (!r) { setHiddenLink('That linked figure is not part of this page.'); return; }
      if (!publishedSince(r.stat) || (reportedSince && (isoDay(r.stat.asOf) ?? '') < reportedSince)) { setHiddenLink(h); return; }
      setStatMode('cards'); setOpenQuote(id); setHiddenLink(null);
      openRow(r);
      // Scroll the card into view behind the sheet, but never move focus out of the open modal.
      window.setTimeout(() => document.getElementById(h)?.scrollIntoView({ block: 'start' }), 60);
      return;
    } else if (h.startsWith('update-')) {
      const id = h.slice(7);
      const u = updates.find((x) => x.id === id);
      if (!u) { setHiddenLink('That linked timeline entry is not part of this page.'); return; }
      if (!publishedSince(u) || (reportedSince && (isoDay(u.date) ?? '') < reportedSince)) { setHiddenLink(h); return; }
      setOpenUpdate(id); targetId = h;
    } else if (h === 'evidence' || h.startsWith('claim-')) {
      setEvidenceOpen(true); targetId = h;
    } else return;
    setHiddenLink(null);
    window.setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) { el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); }
    }, 60);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, updates, since, reportedSince, openRow]);
  useEffect(() => {
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [applyHash]);

  const hasGeo = project.latitude !== null && project.longitude !== null;
  const markers = useMemo(() => hasGeo ? [{ id: project.id, lat: project.latitude as number, lng: project.longitude as number, label: project.title }] : [], [hasGeo, project.id, project.latitude, project.longitude, project.title]);
  const selUpdate = updates.find((u) => u.id === openUpdate) ?? null;

  const chartEntries = finRows.map((r) => ({ id: r.stat.id, entry: r.fin! }));
  const groups = useMemo(() => {
    if (!isDemo) return [{ key: 'all', title: 'Reported figures', rows: shownRows }];
    const g: { key: string; title: string; rows: Row[] }[] = [];
    for (const k of ['received', 'transferred', 'spent', 'budget', 'reported'] as FinancialKind[]) {
      const rs = shownRows.filter((r) => r.fin?.kind === k);
      if (rs.length) g.push({ key: k, title: KIND_LABEL[k], rows: rs });
    }
    const other = shownRows.filter((r) => !r.fin);
    if (other.length) g.push({ key: 'other', title: 'Other reported figures', rows: other });
    return g;
  }, [shownRows, isDemo]);

  return (
    <article className="text-ink [overflow-wrap:anywhere] min-w-0 max-w-full" data-testid={`view-project-${project.id}`}>
      <header className="keep-dark relative overflow-hidden bg-ink-2 text-paper border-b border-paper/10">
        <div className="relative mx-auto max-w-6xl px-5 pt-6 pb-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {project.cause && <span className="meta text-vermilion">{project.cause}</span>}
            {preview && <StatusPill status={project.status} />}
            {project.isSample && <span className="meta border border-paper/40 px-2 py-0.5 rounded-sm">Sample record</span>}
          </div>
          <h1 className="mt-2 font-display text-2xl md:text-3xl font-bold leading-tight tracking-tight max-w-4xl" data-testid="text-project-title">{project.title || 'Untitled project'}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-paper/85">
            <span data-testid="text-organization">{project.organizationName}</span>
            {project.locationName && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-vermilion" aria-hidden />{project.locationName}</span>}
            {project.demonstration && <span className="meta self-center" data-testid="text-source-updated">Source updated {fmtDate(project.demonstration.sourceUpdatedAt)}</span>}
            <span className="inline-flex items-center gap-1">Original source: <SourceLink url={project.sourceUrl} dark /></span>
          </div>
          <nav aria-label="Jump to" className="mt-4 flex flex-wrap gap-2 text-sm">
            <a href="#story" className="inline-flex min-h-11 items-center rounded-sm border border-paper/40 px-3 underline underline-offset-4" data-testid="link-jump-figures">{project.statistics.length} reported figures</a>
            {!evidenceOnly && <a href="#viewer" className="inline-flex min-h-11 items-center rounded-sm border border-paper/40 px-3 underline underline-offset-4" data-testid="link-jump-media">Explore media</a>}
            <a href="#timeline" className="inline-flex min-h-11 items-center rounded-sm border border-paper/40 px-3 underline underline-offset-4" data-testid="link-jump-updates">{project.updates.length} dated updates</a>
            <a href="#evidence" onClick={() => setEvidenceOpen(true)} className="inline-flex min-h-11 items-center rounded-sm border border-paper/40 px-3 underline underline-offset-4" data-testid="link-jump-evidence">Open evidence and sources</a>
          </nav>
          {(since || reportedSince) && <div role="status" className="mt-3 rounded-sm border border-paper/40 p-3 text-sm" data-testid="notice-active-date-filter">
            <p>A date filter is active. Earlier records and records without a publication date may be hidden; they have not been removed.</p>
            <button type="button" onClick={() => { setSince(''); setReportedSince(''); }} className="min-h-11 font-semibold underline underline-offset-4" data-testid="button-show-all-project-content">Show all project content</button>
          </div>}
          <DemoNotice demonstration={project.demonstration} />
          <details className="group mt-1 text-sm text-paper/85" data-testid="details-project-info">
            <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 font-medium underline underline-offset-4">More record details<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden /></summary>
            <div className="mt-2 space-y-1 max-w-3xl">
              {project.demonstration && <p>Public IATI evidence · Activity {project.demonstration.activityId}. No reported result indicators are attached; financial transactions are not evidence of delivered outcomes.</p>}
              {project.publishedAt && <p className="meta">Published {fmtDate(project.publishedAt)}</p>}
              <p className="meta">Updated {fmtDate(project.updatedAt)}</p>
            </div>
          </details>
        </div>
      </header>

      {!evidenceOnly && <div id="viewer" tabIndex={-1} className="scroll-mt-40"><ImmersiveViewer project={project} media={visibleMedia} claims={claims} /></div>}

      <div className="border-b border-ink/15 bg-paper">
        <div className="mx-auto max-w-6xl px-5 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href="/explore" className="min-h-11 inline-flex items-center text-sm underline">Back to map</Link>
          <details className="group w-full sm:w-auto" open={!!since || !!reportedSince} data-testid="details-since">
          <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-medium"><CalendarClock className="h-4 w-4 text-vermilion-deep" aria-hidden />{since ? `Since your last donation: ${fmtDay(since)}` : 'Filter by your last donation date (optional)'}</summary>
          <div className="flex flex-wrap items-center gap-2 pb-2">
          <label htmlFor="since" className="text-sm font-medium">Since your last donation</label>
          <input id="since" type="date" value={since} onChange={(e) => setSince(e.target.value)} aria-describedby="since-help" className="min-h-11 w-full max-w-[13rem] min-w-0 rounded-md border border-ink/40 bg-paper px-2 font-mono text-sm" data-testid="input-since-date" />
          {isDemo && <label className="text-sm">Reported entry date from <input type="date" value={reportedSince} onChange={e => setReportedSince(e.target.value)} className="min-h-11 rounded-md border border-ink/40 bg-paper px-2 font-mono text-sm" data-testid="input-reported-date" /></label>}
          </div>
          </details>
          {(since || reportedSince) && (
            <button type="button" onClick={() => { setSince(''); setReportedSince(''); }} className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-2" data-testid="button-clear-since"><X className="h-4 w-4" aria-hidden />Show everything</button>
          )}
          <button type="button" aria-pressed={evidenceOnly} onClick={() => setEvidenceOnly(!evidenceOnly)} className="min-h-11 px-3 rounded-sm border border-ink/25 text-sm" data-testid="button-evidence-only">Evidence only</button>
          <button type="button" onClick={() => setHelpOpen((o) => !o)} aria-expanded={helpOpen} aria-controls="help-panel" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium sm:ml-auto" data-testid="button-help"><CircleHelp className="h-4 w-4" aria-hidden />How to read this page</button>
          <p id="since-help" className="text-xs text-ink/75 w-full" aria-live="polite" data-testid="text-since-summary">
            {since ? `Filtering by each record's first publication on nujli., not event or transaction dates. ${filteredUpdates.length} timeline entries and ${shownRows.length} figures match. Unknown publication dates are excluded.` : 'Showing the full publication history. Pick your last donation date to see records first published since then.'}
            {reportedSince && ` Also restricted to reported entry dates on or after ${fmtDay(reportedSince)}; this is a separate filter, not donation attribution.`}
          </p>
          {since && <p className="text-xs text-ink/75">Counts use the filtered records shown below. This does not show what your donation paid for.</p>}
        </div>
        <nav aria-label="Project sections" className="mx-auto max-w-6xl px-5 flex flex-wrap gap-x-1 text-sm">
          {[['story', 'Story'], ...(keyMode === 'cards' && nextCards.length ? [['next', 'Next']] : []), ['timeline', 'Timeline'], ...(rows.some((r) => r.fin) ? [['funding', 'Funding']] : []), ['statistics', 'Figures'], ...(images.length ? [['gallery', 'Photos']] : []), ...(videos.length ? [['video', 'Video']] : []), ['evidence', 'Evidence']].map(([s, l]) => <a key={s} href={`#${s}`} className="inline-flex min-h-11 items-center px-2 whitespace-nowrap text-ink/80 hover:text-ink underline-offset-4 hover:underline">{l}</a>)}
        </nav>
      </div>


      <div className="mx-auto max-w-6xl px-5" id="project-main">
        {since && (
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border-l-4 border-vermilion-deep bg-paper-2 px-4 py-3" role="status" data-testid="strip-since">
            <CalendarClock className="h-4 w-4" aria-hidden />
            <p className="font-medium">Here's what this organization has reported since you last gave.</p>
            <p className="text-sm text-ink/80 w-full">Records first published on or after {fmtDay(since)}. Headline, cards, chart and figures below respect this filter. Recorded dates remain context, not proof of donation allocation.</p>
          </div>
        )}
        {helpOpen && (
          <section id="help-panel" aria-labelledby="help-h" className="mt-6 rounded-md border border-ink/25 bg-paper-2 p-5" data-testid="panel-help">
            <div className="flex items-start justify-between gap-3">
              <h2 id="help-h" className="font-display text-xl font-semibold">How to read this page</h2>
              <button type="button" onClick={() => setHelpOpen(false)} className="grid h-11 w-11 place-items-center" aria-label="Close help"><X className="h-4 w-4" aria-hidden /></button>
            </div>
            <ul className="mt-3 grid gap-2 text-sm md:grid-cols-2 list-disc pl-5">
              <li>Every number shows its value, unit, date and source. Tap "Source" to see exactly where it came from.</li>
              <li>Money entries are shown one at a time. nujli. never adds them into a total.</li>
              <li><strong>Money received</strong>, <strong>Money transferred</strong> and <strong>Money spent</strong> come from coded transaction types. A <strong>Reported budget</strong> is a plan, not spending.</li>
              <li>Transaction date is when the transaction took place, as reported by the publisher. It is not the date the data was published. Value date is the date used for the currency value; the two can differ.</li>
              <li>Evidence labels (Organization Reported, Corroborated, Independently Reviewed) are only those saved for each claim.</li>
              <li>Use Table or Read as text for any group of figures. Links ending in #stat- or #update- open a specific entry.</li>
            </ul>
          </section>
        )}
        {preview && project.warnings.length > 0 && (
          <div className="mt-8 border border-vermilion/60 bg-vermilion/5 rounded-md p-4" role="note">
            <p className="meta text-vermilion-deep">Generation warnings</p>
            <ul className="mt-2 list-disc pl-5 text-sm space-y-1">{project.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}
        {hiddenLink && (
          <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-ink/40 bg-paper-2 p-4 text-sm" data-testid="notice-hidden-link">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {hiddenLink.startsWith('stat-') || hiddenLink.startsWith('update-')
              ? <><span>The linked entry is hidden by your date filters.</span><button type="button" onClick={() => { setSince(''); setReportedSince(''); window.setTimeout(applyHash, 0); }} className="min-h-11 font-medium underline" data-testid="button-show-linked">Show everything and open it</button></>
              : <span>{hiddenLink}</span>}
            <button type="button" onClick={() => setHiddenLink(null)} className="grid h-11 w-11 place-items-center ml-auto" aria-label="Dismiss notice"><X className="h-4 w-4" aria-hidden /></button>
          </div>
        )}

        <section id="story" aria-labelledby="story-h" className="py-10 scroll-mt-40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Kicker className="text-ink/75">The record so far</Kicker>
            {headline && <ModeSwitch label="Key numbers view" value={keyMode} onChange={(v) => { if (v === 'cards' || v === 'table' || v === 'text') setKeyMode(v); }} options={[
              { v: 'cards', label: 'Cards', icon: <LayoutGrid className="h-4 w-4" aria-hidden /> },
              { v: 'table', label: 'Table', icon: <Table2 className="h-4 w-4" aria-hidden /> },
              { v: 'text', label: 'Read as text', icon: <FileText className="h-4 w-4" aria-hidden /> },
            ]} />}
          </div>
          <h2 id="story-h" className="sr-only">Headline fact and key numbers</h2>
          {headline && keyMode !== 'cards' ? (
            <div className="mt-4" data-testid="key-numbers-alt">
              <p className="text-sm text-ink/80 mb-3">The headline and up to {nextCards.length} other key numbers. Each is a single reported entry; none are added together.</p>
              {keyMode === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm stack-table">
                    <caption className="sr-only">Key numbers</caption>
                    <thead><tr className="text-left border-b border-ink/30"><th scope="col" className="py-2 pr-3">Figure</th><th scope="col" className="py-2 pr-3">Value</th><th scope="col" className="py-2 pr-3">Date</th><th scope="col" className="py-2 pr-3">Evidence label</th><th scope="col" className="py-2"><span className="sr-only">Source</span></th></tr></thead>
                    <tbody>{[headline, ...nextCards].map((r, i) => (
                      <tr key={r.stat.id} className="border-b border-ink/10 align-top">
                        <td data-label="Figure" className="py-2 pr-3">{i === 0 && <span className="font-semibold">Headline: </span>}{statTitle(r)}{r.fin && <span className="block text-xs text-ink/80">{r.stat.label}</span>}</td>
                        <td data-label="Value" className="py-2 pr-3 font-mono">{statValueText(r)} {statUnit(r)}</td>
                        <td data-label="Date" className="py-2 pr-3">{statDate(r)}</td>
                        <td data-label="Evidence label" className="py-2 pr-3">{r.claim?.label ?? 'Not recorded'}</td>
                        <td className="py-1"><button type="button" onClick={() => openRow(r)} className="min-h-11 font-medium underline">Source<span className="sr-only"> for {statTitle(r)}</span></button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : (
                <ul className="space-y-2 max-w-3xl list-disc pl-5">{[headline, ...nextCards].map((r, i) => (
                  <li key={r.stat.id}>{i === 0 ? 'Headline. ' : ''}{statTitle(r)}: {statValueText(r)}{statUnit(r) ? ` ${statUnit(r)}` : ''}. {statDate(r)}. {r.claim ? `Evidence label: ${r.claim.label}.` : ''} <button type="button" onClick={() => openRow(r)} className="min-h-11 font-medium underline">Source<span className="sr-only"> for {statTitle(r)}</span></button></li>
                ))}</ul>
              )}
            </div>
          ) : headline ? (
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-end" data-testid="card-headline">
              <div>
                <p className="text-lg font-medium">{statTitle(headline)}{headline.fin && headline.fin.kind !== 'budget' && ' · most recent single entry'}</p>
                <p className="mt-2 font-display text-5xl md:text-7xl font-bold tracking-tight leading-none" data-testid="text-headline-value">
                  <CountUp value={headline.fin?.amount ?? null} text={statValueText(headline)} />
                  {statUnit(headline) && <span className="ml-2 text-2xl font-medium text-ink/75">{statUnit(headline)}</span>}
                </p>
                <p className="mt-3 text-sm">{statDate(headline)}</p>
                {headline.fin && <p className="mt-1 text-sm text-ink/80">{headline.fin.kind === 'budget' ? LIMIT_BUDGET : 'One reported entry, not a total of all spending.'}</p>}
              </div>
              <div className="space-y-2 text-sm">
                {headline.fin && <p className="text-ink/85">{KIND_EXPLAIN[headline.fin.kind]}</p>}
                <p><span className="font-semibold mr-1">Label as published:</span>{headline.stat.label || 'Not reported'}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {headline.claim && <ClaimLabelBadge label={headline.claim.label} />}
                  <button type="button" onClick={() => openRow(headline)} className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-ink px-4 text-paper font-medium" data-testid="button-headline-source">Source and limitations <ArrowRight className="h-4 w-4" aria-hidden /></button>
                </div>
              </div>
            </div>
          ) : <p className="mt-4 text-ink/80" data-testid="text-headline-empty">{since || reportedSince ? 'No sourced figures match these date filters.' : 'No sourced figure has been reported yet.'}</p>}
          <div id="overview" className="mt-8 scroll-mt-40">
            {project.overview ? (
              <p className="max-w-3xl text-lg leading-relaxed whitespace-pre-line text-ink/85" data-testid="text-overview">{project.overview}</p>
            ) : <Empty title="No overview was extracted." kicker="Overview">The source page did not provide a description we could quote.</Empty>}
          </div>
        </section>

        {nextCards.length > 0 && keyMode === 'cards' && (
          <Section id="next" kicker="Next" title="Worth a closer look">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
              {nextCards.map((r) => (
                <li key={r.stat.id} className="rounded-md border border-ink/20 p-4 flex flex-col" data-testid={`card-next-${r.stat.id}`}>
                  <div className="flex items-center gap-2 flex-wrap">{r.fin && <KindTag kind={r.fin.kind} />}<span className="text-sm font-semibold">{statTitle(r)}</span></div>
                  <p className="mt-2 font-display text-2xl font-bold">{statValueText(r)}{statUnit(r) && <span className="ml-1 text-sm font-medium text-ink/75">{statUnit(r)}</span>}</p>
                  <p className="mt-1 text-xs text-ink/80">{statDate(r)}</p>
                  <a href={`#stat-${r.stat.id}`} className="mt-auto pt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium underline underline-offset-2">Open details<span className="sr-only"> for {statTitle(r)}</span></a>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section id="timeline" kicker="Timeline" title="Dated timeline" intro={isDemo ? 'Dates are reported transaction dates. Select an entry to see its details and the project marker.' : 'Select an entry to see its details and the project marker.'}>
          {filteredUpdates.length === 0 ? (
            <Empty kicker="Timeline" title={since ? 'Nothing new since that date.' : 'No dated updates found.'}>Updates appear only with a date and a quoted source.</Empty>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
              <ol className="relative border-l border-ink/30 ml-2">
                {filteredUpdates.map((u) => {
                  const open = openUpdate === u.id;
                  const fin = updateFin.get(u.id) ?? null;
                  return (
                    <li key={u.id} id={`update-${u.id}`} tabIndex={-1} className="relative pl-6 pb-5 scroll-mt-40">
                      <span className={cn('absolute -left-[6px] top-4 h-3 w-3 rounded-full border-2', open ? 'bg-vermilion-deep border-vermilion-deep' : 'bg-paper border-ink')} aria-hidden />
                      <button type="button" onClick={() => { setOpenUpdate(open ? null : u.id); if (!open) setMapFocus((n) => n + 1); }} aria-expanded={open} className="text-left w-full min-h-11 group" data-testid={`button-update-${u.id}`}>
                        <span className="text-xs font-mono text-ink/80">{fin ? `Transaction date ${fmtDay(fin.transactionDate ?? u.date)}` : fmtDay(isoDay(u.date))}</span>
                        <span className="mt-1 flex items-center gap-2 font-display text-lg font-semibold">
                          {fin ? `${fin.label}: ${fmtAmount(fin.amount, fin.currency, fin.rawAmount)}` : u.title}
                          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
                        </span>
                        {open && <span className="sr-only">Selected</span>}
                      </button>
                      {open && (
                        <div className="mt-3 space-y-3 max-w-2xl">
                          {fin ? (
                            <>
                              <p className="text-sm">{KIND_EXPLAIN[fin.kind]}</p>
                              <FieldList fields={fin.fields} />
                              <details className="rounded-md border border-ink/15"><summary className="min-h-11 flex items-center px-3 cursor-pointer text-sm font-medium">Show saved source text</summary><pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all border-t border-ink/15 p-3 font-mono text-xs">{u.quote || u.body}</pre></details>
                            </>
                          ) : (
                            <>
                              <p className="text-sm leading-relaxed whitespace-pre-line">{u.body}</p>
                              {u.quote && <blockquote className="border-l-2 border-vermilion pl-3 text-sm italic text-ink/80">{u.quote}</blockquote>}
                            </>
                          )}
                          <div className="flex flex-wrap items-center gap-x-5"><SourceLink url={u.sourceUrl} /><CopyLinkButton anchor={`update-${u.id}`} /></div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              <aside aria-label="Project location" className="lg:sticky lg:top-44 self-start">
                {hasGeo ? (
                  <div className="keep-dark rounded-md overflow-hidden border border-ink/20">
                    <WorldMap key={mapFocus} markers={markers} selectedId={selUpdate ? project.id : null} focusId={selUpdate ? project.id : null} wheelZoom={false} label={`Map marker for ${project.title}`} className="h-64 w-full" />
                    <p className="bg-ink-2 text-paper p-3 text-xs leading-relaxed" aria-live="polite" data-testid="text-map-status">
                      {selUpdate ? `Highlighted: this project's marker (${project.locationName || 'location as published'}). The source gives no separate location for this entry.` : `Project marker: ${project.locationName || 'location as published'}. Select a timeline entry to highlight it.`}
                    </p>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 rounded-md border border-dashed border-ink/30 p-4 text-sm"><MapPinOff className="h-4 w-4" aria-hidden />No coordinates were published for this project, so no marker is shown.</p>
                )}
              </aside>
            </div>
          )}
        </Section>

        {(chartEntries.length > 0 || (since && rows.some((r) => r.fin))) && (
          <Section id="funding" kicker="Funding" title="Funding over time" intro="Individual reported entries, each plotted at its reported date. Date filters above restrict which entries are included. Choose one type and currency at a time.">
            {chartEntries.length === 0 && <p className="text-sm">No money entries match these date filters.</p>}
            <FundingChart key={`${since}:${reportedSince}`} entries={chartEntries} onOpen={openById} />
          </Section>
        )}

        <Section id="statistics" kicker="Figures" title="Source-linked figures"
          aside={<div className="flex min-w-0 max-w-full flex-col items-start sm:items-end gap-2">
            <ModeSwitch label="Figures view" value={statMode} onChange={(v) => { if (v === 'cards' || v === 'table' || v === 'text') setStatMode(v); }} options={[
              { v: 'cards', label: 'Cards', icon: <LayoutGrid className="h-4 w-4" aria-hidden /> },
              { v: 'table', label: 'Table', icon: <Table2 className="h-4 w-4" aria-hidden /> },
              { v: 'text', label: 'Read as text', icon: <FileText className="h-4 w-4" aria-hidden /> },
            ]} />
            {since && undatedHidden > 0 && <p className="text-xs text-ink/75">{undatedHidden} figure{undatedHidden === 1 ? '' : 's'} with unknown publication date not counted as new</p>}
          </div>}>
          {shownRows.length === 0 ? (
            <Empty kicker="Figures" title={since || reportedSince ? 'No figures match these date filters.' : 'No figures with a quotable source.'}>
              {since ? 'Figures without a known first-publication date are never treated as new.' : 'Figures appear here only when the original page states them and the quote is preserved.'}
            </Empty>
          ) : groups.map((g) => (
            <div key={g.key} className="mb-8">
              <h3 className="font-display text-lg font-semibold mb-1">{g.title} <span className="text-sm font-normal text-ink/75">· {g.rows.length} entr{g.rows.length === 1 ? 'y' : 'ies'}, not added together</span></h3>
              {isDemo && g.key in KIND_EXPLAIN && <p className="text-sm text-ink/80 mb-3 max-w-3xl">{KIND_EXPLAIN[g.key as FinancialKind]}</p>}
              {statMode === 'cards' && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {g.rows.map((r) => {
                    const s = r.stat; const open = openQuote === s.id;
                    return (
                      <div key={s.id} id={`stat-${s.id}`} tabIndex={-1} className={cn('rounded-md border p-4 flex flex-col scroll-mt-40', isNew(s) ? 'border-vermilion-deep border-2' : 'border-ink/20')} data-testid={`card-stat-${s.id}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-ink/80">{statDate(r)}</span>
                          {r.claim && <ClaimLabelBadge label={r.claim.label} />}
                        </div>
                        {isNew(s) && <span className="mt-2 self-start text-xs font-semibold">New since your date</span>}
                        <p className="mt-3 font-display text-3xl font-bold tracking-tight">{statValueText(r)}{statUnit(r) && <span className="ml-1 text-lg font-medium text-ink/75">{statUnit(r)}</span>}</p>
                        <p className="mt-1 text-sm font-medium">{statTitle(r)}</p>
                        {r.fin && <p className="mt-1 text-xs text-ink/80">Label as published: {s.label}</p>}
                        <div className="mt-auto pt-3 flex flex-wrap gap-x-4">
                          <button type="button" onClick={() => setOpenQuote(open ? null : s.id)} aria-expanded={open} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium" data-testid={`button-quote-${s.id}`}>
                            Details <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
                          </button>
                          <button type="button" onClick={() => openRow(r)} className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2" data-testid={`button-source-${s.id}`}>Source</button>
                        </div>
                        {open && (
                          <div className="mt-2 space-y-3 border-t border-ink/15 pt-3">
                            {r.fin ? <FieldList fields={r.fin.fields} /> : <blockquote className="border-l-2 border-vermilion pl-3 text-sm italic text-ink/80">{s.quote || 'No quote supplied.'}</blockquote>}
                            <p className="text-xs text-ink/80"><strong>Limitations.</strong> {statLimit(r)}</p>
                            {r.fin && s.quote && <details><summary className="min-h-11 flex items-center cursor-pointer text-sm font-medium">Show saved source text</summary><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">{s.quote}</pre></details>}
                            <SourceLink url={s.sourceUrl} />
                            <CopyLinkButton anchor={`stat-${s.id}`} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {statMode === 'table' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm stack-table">
                    <caption className="sr-only">{g.title}</caption>
                    <thead><tr className="text-left border-b border-ink/30"><th scope="col" className="py-2 pr-3">Figure</th><th scope="col" className="py-2 pr-3">Value</th><th scope="col" className="py-2 pr-3">Date</th><th scope="col" className="py-2 pr-3">Evidence label</th><th scope="col" className="py-2"><span className="sr-only">Source</span></th></tr></thead>
                    <tbody>{g.rows.map((r) => (
                      <tr key={r.stat.id} className="border-b border-ink/10 align-top">
                        <td data-label="Figure" className="py-2 pr-3">{statTitle(r)}{r.fin && <span className="block text-xs text-ink/80">{r.stat.label}</span>}</td>
                        <td data-label="Value" className="py-2 pr-3 font-mono">{statValueText(r)} {statUnit(r)}</td>
                        <td data-label="Date" className="py-2 pr-3">{statDate(r)}</td>
                        <td data-label="Evidence label" className="py-2 pr-3">{r.claim?.label ?? 'Not recorded'}</td>
                        <td className="py-1"><button type="button" onClick={() => openRow(r)} className="min-h-11 font-medium underline">Source</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              {statMode === 'text' && (
                <ul className="space-y-2 max-w-3xl list-disc pl-5">{g.rows.map((r) => (
                  <li key={r.stat.id}>{statTitle(r)}: {statValueText(r)}{statUnit(r) ? ` ${statUnit(r)}` : ''}. {statDate(r)}. {r.claim ? `Evidence label: ${r.claim.label}.` : ''} <button type="button" onClick={() => openRow(r)} className="min-h-11 font-medium underline">Source</button></li>
                ))}</ul>
              )}
            </div>
          ))}
        </Section>

        <Section id="gallery" kicker="Photos" title="Photo gallery">
          {images.length === 0 ? (
            <Empty kicker="Photos" title={project.demonstration ? 'No authorized media attached yet.' : 'No permitted photos yet.'}>Photos are shown only with confirmed reuse permission. Nothing is substituted.</Empty>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 [&>*]:mb-3">
              {images.map((m) => (
                <figure key={m.id} className="break-inside-avoid">
                  <button type="button" onClick={() => setLightbox(m)} className="block w-full overflow-hidden rounded-sm bg-ink/5" data-testid={`button-photo-${m.id}`} aria-label={`Open photo: ${m.caption || 'untitled'}`}>
                    <img src={m.url} alt={m.caption || 'Project photo'} loading="lazy" className="w-full hover:scale-[1.02] transition-transform duration-500" />
                  </button>
                  <figcaption className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/80">
                    <span>{m.caption}</span>
                    {preview && <span className="meta">{m.permissionStatus}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </Section>

        <Section id="video" kicker="Video" title="Video">
          {videos.length === 0 ? (
            <Empty kicker="Video" title="No permitted video yet.">
              <span className="inline-flex items-center gap-2"><VideoOff className="h-4 w-4" aria-hidden />When a video has confirmed permission, it plays here with its source.</span>
            </Empty>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {videos.map((v) => {
                return (
                  <figure key={v.id}>
                    <MediaVideo url={v.url} sourceUrl={v.sourceUrl} title={v.caption || 'Project video'} testId={`video-${v.id}`} />
                    <figcaption className="mt-2 space-y-1 text-sm"><span className="flex flex-wrap justify-between gap-2"><span>{v.caption}</span><SourceLink url={v.sourceUrl} /></span><MediaContextNote caption={v.caption} permission={v.permissionStatus} /></figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </Section>

        <section id="evidence" aria-labelledby="evidence-h" tabIndex={-1} className="py-10 border-t border-ink/15 scroll-mt-40">
          <Kicker className="text-ink/75">Evidence</Kicker>
          <h2 id="evidence-h" className="mt-2 font-display text-2xl md:text-3xl font-semibold">
            <button type="button" onClick={() => setEvidenceOpen((o) => !o)} aria-expanded={evidenceOpen} aria-controls="evidence-body" className="inline-flex min-h-11 items-center gap-2 text-left" data-testid="button-toggle-evidence">
              Evidence panel <span className="text-base font-normal text-ink/75">({claims.length} claim{claims.length === 1 ? '' : 's'})</span>
              <ChevronDown className={cn('h-5 w-5 transition-transform', evidenceOpen && 'rotate-180')} aria-hidden />
            </button>
          </h2>
          <div id="evidence-body" hidden={!evidenceOpen} className="mt-6">
            {claims.length === 0 ? (
              <Empty kicker="Claims" title={since ? 'No claims first published since that date.' : 'No claims recorded.'}>A claim needs a quote and a source link before it can be shown.</Empty>
            ) : (
              <ul className="divide-y divide-ink/10 border-y border-ink/10">
                {claims.map((c) => {
                  const fin = isDemo ? decodeFinancial(c.text) : null;
                  return (
                    <li key={c.id} id={`claim-${c.id}`} className="py-5 grid gap-3 md:grid-cols-[1fr_auto]" data-testid={`row-claim-${c.id}`}>
                      <div className="min-w-0">
                        {fin ? (
                          <>
                            <p className="font-medium">{fin.label}: {fmtAmount(fin.amount, fin.currency, fin.rawAmount)} <span className="font-normal text-ink/80">· {fin.kind === 'budget' ? `period ${fmtDay(fin.periodStart)} to ${fmtDay(fin.periodEnd)}` : `transaction date ${fmtDay(fin.transactionDate)}`}</span></p>
                            <details className="mt-2"><summary className="min-h-11 flex items-center cursor-pointer text-sm font-medium">Show saved claim text</summary><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">{c.text}</pre></details>
                          </>
                        ) : (
                          <>
                            <p className="font-medium">{c.text}</p>
                            <blockquote className="mt-2 border-l-2 border-ink/30 pl-3 text-sm italic text-ink/80">{c.quote}</blockquote>
                          </>
                        )}
                        <div className="mt-1"><SourceLink url={c.sourceUrl} /></div>
                        {c.reviews.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {c.reviews.map((r) => (
                              <div key={r.id} className="keep-dark raised rounded-sm bg-ink text-paper p-4 text-sm">
                                <p className="meta text-vermilion">Independent review, {fmtDate(r.createdAt)}</p>
                                <p className="mt-2">{r.findings}</p>
                                <p className="mt-2 text-paper/85"><span className="meta text-paper/75 mr-2">Limitations</span>{r.limitations}</p>
                                <div className="mt-2 flex flex-wrap gap-3">{r.evidenceUrls.map((u) => <SourceLink key={u} url={u} dark />)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="md:text-right"><ClaimLabelBadge label={c.label} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-4 text-xs text-ink/80">Labels are defined on the <a href={`${import.meta.env.BASE_URL}methodology`} className="underline inline-flex min-h-11 items-center">methodology page</a>. nujli. does not apply automated verification labels.</p>
          </div>
        </section>
      </div>

      <SourceSheet target={sheet} onClose={() => setSheet(null)} />

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl bg-ink text-paper border-paper/15 p-3">
          <DialogTitle className="sr-only">{lightbox?.caption || 'Photo'}</DialogTitle>
          <DialogDescription className="sr-only">Full size project photo</DialogDescription>
          {lightbox && (
            <>
              <img src={lightbox.url} alt={lightbox.caption || 'Project photo'} className="max-h-[75vh] w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              <div className="flex flex-wrap justify-between gap-2 p-2 text-sm"><span>{lightbox.caption}</span><SourceLink url={lightbox.sourceUrl} dark /></div>
            </>
          )}
          {!lightbox && <ImageOff className="h-5 w-5" aria-hidden />}
        </DialogContent>
      </Dialog>
    </article>
  );
}
