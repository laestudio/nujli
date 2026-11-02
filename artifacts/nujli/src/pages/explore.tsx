import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, ImageOff, MapPinOff, RotateCcw, Search, X } from 'lucide-react';
import { useListPublicProjects } from '@workspace/api-client-react';
import type { Project } from '@workspace/api-client-react';
import { Page } from '@/components/shell';
import { DemoNotice } from '@/components/demo-notice';
import { WorldMap, isValidCamera, type MapCamera, type MapMarker } from '@/components/world-map';
import { Block, Empty, ErrorState } from '@/components/states';
import { cn } from '@/lib/utils';
import { fmtDate } from '@/lib/format';
import { fmtAmount, fmtDay, pickHeadline } from '@/lib/financial';

/* Session-scoped UI state only. Never used for auth or trust decisions; every value is re-validated. */
const KEY = 'nujli.explore.v1';
interface Saved { q: string; cause: string; org: string; region: string; selected: string | null; camera: MapCamera | null }
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
function load(): Saved {
  const d: Saved = { q: '', cause: '', org: '', region: '', selected: null, camera: null };
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return d;
    const o = JSON.parse(raw) as Record<string, unknown>;
    return { q: str(o.q), cause: str(o.cause), org: str(o.org), region: str(o.region), selected: str(o.selected, 100) || null, camera: isValidCamera(o.camera) ? o.camera : null };
  } catch { return d; }
}
function save(s: Saved) { try { window.sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: state just won't persist */ } }

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

function latestPublishedUpdate(p: Project): string | null {
  let best: string | null = null;
  for (const u of p.updates) if (u.publishedAt && (!best || u.publishedAt > best)) best = u.publishedAt;
  return best;
}

export default function Explore() {
  const init = useMemo(load, []);
  const [q, setQ] = useState(init.q);
  const [cause, setCause] = useState(init.cause);
  const [org, setOrg] = useState(init.org);
  const [region, setRegion] = useState(init.region);
  const [selected, setSelected] = useState<string | null>(init.selected);
  const [focus, setFocus] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [mapKey, setMapKey] = useState(0);
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<'map' | 'list'>('map');
  const camera = useRef<MapCamera | null>(init.camera);
  const restoredCam = useRef<MapCamera | null>(init.camera);

  const all = useListPublicProjects();
  const projects = useMemo(() => all.data ?? [], [all.data]);
  const orgs = useMemo(() => [...new Set(projects.map((p) => p.organizationName))].sort(), [projects]);
  const causes = useMemo(() => [...new Set(projects.map((p) => p.cause).filter(Boolean))].sort(), [projects]);
  const regions = useMemo(() => [...new Set(projects.map((p) => p.locationName.trim()).filter(Boolean))].sort(), [projects]);

  const filtered = useMemo(() => {
    const t = norm(q.trim());
    return projects.filter((p) =>
      (!cause || p.cause === cause) && (!org || p.organizationName === org) && (!region || p.locationName.trim() === region)
      && (!t || norm(`${p.title} ${p.organizationName} ${p.locationName} ${p.cause} ${p.overview}`).includes(t)));
  }, [projects, q, cause, org, region]);
  const hasFilter = !!(q.trim() || cause || org || region);

  // drop stale filter values / selections once data is known
  useEffect(() => {
    if (!all.data) return;
    if (cause && !causes.includes(cause)) setCause('');
    if (org && !orgs.includes(org)) setOrg('');
    if (region && !regions.includes(region)) setRegion('');
  }, [all.data, causes, orgs, regions, cause, org, region]);
  const sel = filtered.find((p) => p.id === selected) ?? null;
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!all.data || !selected || sel) return;
    setSelected(null);
    setNotice(projects.some((p) => p.id === selected) ? 'Your previous selection is hidden by the current filters.' : 'Your previous selection is no longer published.');
  }, [all.data, selected, sel, projects]);

  useEffect(() => { save({ q, cause, org, region, selected, camera: camera.current }); }, [q, cause, org, region, selected]);
  const onViewChange = (c: MapCamera) => { camera.current = c; save({ q, cause, org, region, selected, camera: c }); };

  const markers = useMemo<MapMarker[]>(() => filtered.filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => ({ id: p.id, lat: p.latitude as number, lng: p.longitude as number, label: p.title })), [filtered]);
  const head = useMemo(() => (sel ? pickHeadline(sel.statistics, !!sel.demonstration) : null), [sel]);
  const photo = sel?.media.find((m) => m.type === 'image' && m.permissionStatus === 'approved') ?? null;
  const siblings = sel && sel.locationName.trim() ? filtered.filter((p) => p.id !== sel.id && p.locationName.trim() === sel.locationName.trim()) : [];
  const latest = sel ? latestPublishedUpdate(sel) : null;

  const pick = (id: string) => {
    setNotice('');
    setSelected(id);
    const p = filtered.find((x) => x.id === id);
    if (p && p.latitude !== null && p.longitude !== null) { setFocus(id); setNonce((n) => n + 1); }
    setView('map');
  };
  const back = () => setSelected(null);
  const clearAll = () => { setQ(''); setCause(''); setOrg(''); setRegion(''); };
  const resetView = () => { setSelected(null); setFocus(null); camera.current = null; restoredCam.current = null; save({ q, cause, org, region, selected: null, camera: null }); setMapKey((k) => k + 1); };

  const ctl = 'h-11 w-full min-w-0 rounded-sm border border-paper/20 bg-ink/80 backdrop-blur px-3 text-sm text-paper';

  return (
    <Page dark footer={false} tatreez={false}>
      <div className="relative lg:h-[calc(100dvh-4rem)]">
        {/* Header and filters, floating over the map */}
        <div className="relative z-20 lg:absolute lg:inset-x-0 lg:top-0 pointer-events-none">
          <div className="pointer-events-auto px-4 pt-4 pb-3 sm:px-6 lg:max-w-[880px] space-y-3 lg:bg-gradient-to-b lg:from-ink lg:via-ink/80 lg:to-transparent lg:pb-10">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="meta text-paper/55">nujli. / Impact Revealed</p>
                <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight" data-testid="text-explorer-title">Impact Explorer</h1>
              </div>
              <div role="group" aria-label="Show projects as" className="lg:hidden inline-flex rounded-sm border border-paper/25">
                {(['map', 'list'] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn('min-h-11 px-4 text-sm capitalize', view === v ? 'bg-paper text-ink' : 'text-paper')} data-testid={`button-view-${v}`}>{v}</button>)}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper/50" aria-hidden />
              <label htmlFor="map-search" className="sr-only">Search projects by name, place, organization or cause</label>
              <input id="map-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Where would you like to explore?" className={cn(ctl, 'pl-9 text-base')} data-testid="input-search" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="block"><span className="sr-only">Cause</span>
                <select value={cause} onChange={(e) => setCause(e.target.value)} className={ctl} data-testid="select-cause"><option value="">All causes</option>{causes.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
              <label className="block"><span className="sr-only">Organization</span>
                <select value={org} onChange={(e) => setOrg(e.target.value)} className={ctl} data-testid="select-organization"><option value="">All organizations</option>{orgs.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
              <label className="block"><span className="sr-only">Region, as stated by the project</span>
                <select value={region} onChange={(e) => setRegion(e.target.value)} className={ctl} data-testid="select-region"><option value="">All regions</option>{regions.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <p className="meta text-paper/60" role="status" aria-live="polite" data-testid="text-result-count">{all.isLoading ? 'Loading projects' : `${filtered.length} published project${filtered.length === 1 ? '' : 's'}${markers.length !== filtered.length ? `, ${markers.length} on map` : ''}`}</p>
              {hasFilter && <button type="button" onClick={clearAll} className="inline-flex min-h-11 items-center gap-1 underline text-paper/70 hover:text-paper" data-testid="button-clear-filters"><X className="h-3 w-3" />Clear filters</button>}
              <button type="button" onClick={resetView} className="inline-flex min-h-11 items-center gap-1 underline text-paper/70 hover:text-paper" data-testid="button-reset-view"><RotateCcw className="h-3 w-3" />Reset view</button>
            </div>
            {notice && <p className="text-sm text-paper/80" role="status" data-testid="text-selection-notice">{notice}</p>}
          </div>
        </div>

        {/* Map */}
        <div className={cn('relative h-[64dvh] lg:absolute lg:inset-0 lg:h-auto', view === 'list' && 'max-lg:hidden')}>
          {all.isError ? (
            <div className="grid h-full place-items-center p-6"><div className="max-w-sm"><ErrorState error={all.error} onRetry={() => all.refetch()} /></div></div>
          ) : (
            <WorldMap key={mapKey} markers={markers} selectedId={sel?.id ?? null} focusId={focus} focusNonce={nonce} dimUnselected
              initialView={restoredCam.current} onViewChange={onViewChange} onSelect={pick} className="absolute inset-0" />
          )}
          {!all.isLoading && !all.isError && projects.length === 0 && (
            <div className="absolute inset-x-4 bottom-4 sm:left-6 sm:right-auto sm:max-w-sm"><Empty dark kicker="Nothing published yet" title="The map is honestly empty.">Markers appear only when an organization approves and publishes a real Impact Page.</Empty></div>
          )}

          {sel && (
            <section className="absolute z-20 left-3 right-3 bottom-3 sm:left-auto sm:right-16 sm:w-[360px] max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-md border border-paper/15 bg-ink/95 backdrop-blur text-paper shadow-2xl rise" aria-label={`Preview: ${sel.title}`} data-testid="card-preview">
              {photo ? (
                <figure className="relative aspect-[16/10] bg-ink-2">
                  {!failedPhotos.has(photo.url) ? <img src={photo.url} alt={photo.caption || `Photograph from ${sel.title}`} loading="lazy" className="h-full w-full object-cover" data-testid="img-preview" onError={() => setFailedPhotos(previous => new Set(previous).add(photo.url))} /> :
                    <p role="status" className="p-4 text-sm text-paper">The published photograph could not load. Its original source remains available.</p>}
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent px-3 pb-2 pt-6 meta text-paper/80">Photo: {sel.organizationName}{photo.sourceUrl && <> · <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">source</a></>}</figcaption>
                </figure>
              ) : (
                <div className="flex items-center gap-2 border-b border-paper/10 px-4 py-3 text-xs text-paper/60" data-testid="text-no-photo"><ImageOff className="h-4 w-4" aria-hidden />No authorized photograph published for this project.</div>
              )}
              <div className="p-4">
                <p className="meta text-vermilion">{sel.cause || 'Cause not stated'}</p>
                <h2 className="mt-1 font-display text-xl font-bold leading-tight" data-testid="text-preview-title">{sel.title}</h2>
                <p className="mt-1 text-sm text-paper/75">{sel.organizationName} · {sel.locationName ? `${sel.locationName} (approximate)` : 'Location not stated'}</p>
                {sel.demonstration && <div className="text-paper/85"><DemoNotice demonstration={sel.demonstration} /></div>}
                {head && (
                  <div className="mt-3 border-l-2 border-vermilion pl-3" data-testid="text-preview-headline">
                    <p className="font-display text-2xl font-bold">{head.fin ? fmtAmount(head.fin.amount, head.fin.currency, head.fin.rawAmount) : `${head.stat.value}${head.stat.unit ? ` ${head.stat.unit}` : ''}`}</p>
                    <p className="text-xs text-paper/75">{head.fin ? `${head.fin.label}. ${head.fin.kind === 'budget' ? `Plan for ${fmtDay(head.fin.periodStart)} to ${fmtDay(head.fin.periodEnd)}, not spending.` : `Single entry dated ${fmtDay(head.fin.transactionDate)}, not a total.`}` : `${head.stat.label || 'Unlabelled figure'}. ${head.stat.asOf ? `As of ${fmtDay(head.stat.asOf.slice(0, 10))}.` : 'Date not reported.'}`}</p>
                  </div>
                )}
                <p className="mt-3 meta text-paper/55" data-testid="text-preview-latest">{latest ? `Latest update published ${fmtDate(latest)}` : sel.publishedAt ? `Page published ${fmtDate(sel.publishedAt)} · update publication dates not recorded` : 'Publication date not recorded'}</p>
                {siblings.length > 0 && (
                  <div className="mt-3 border-t border-paper/10 pt-3">
                    <p className="meta text-paper/55">Also in {sel.locationName}</p>
                    <ul className="mt-1">{siblings.map((p) => <li key={p.id}><button type="button" onClick={() => pick(p.id)} className="min-h-11 w-full text-left text-sm underline-offset-4 hover:underline" data-testid={`button-sibling-${p.id}`}>{p.title}</button></li>)}</ul>
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between gap-2">
                  <button type="button" onClick={back} className="inline-flex min-h-11 items-center gap-1 text-sm text-paper/80 hover:text-paper" data-testid="button-back-to-map"><ArrowLeft className="h-4 w-4" />Back to Map</button>
                  <Link href={`/projects/${sel.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm bg-vermilion px-4 text-sm font-medium text-white hover:bg-paper hover:text-ink transition-colors" data-testid="link-open-project">Explore This Project <ArrowRight className="h-4 w-4" /></Link>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Project list: keyboard/text alternative (always on desktop, toggle on mobile) */}
        <nav aria-label="Project list" className={cn('relative z-10 px-3 pb-6 lg:absolute lg:left-4 lg:bottom-4 lg:w-[320px] lg:max-h-[38%] lg:overflow-y-auto lg:rounded-md lg:border lg:border-paper/15 lg:bg-ink/85 lg:backdrop-blur lg:p-2', view === 'map' && 'max-lg:hidden')} data-testid="list-projects">
          <p className="meta text-paper/50 px-2 py-2">Projects</p>
          {all.isLoading && <div className="space-y-2 px-2">{[0, 1, 2].map((i) => <Block key={i} className="h-12 bg-paper/10" />)}</div>}
          {!all.isLoading && hasFilter && filtered.length === 0 && <p className="px-2 py-3 text-sm text-paper/70">No published project matches. Try a broader search or clear the filters.</p>}
          <ul role="list">
            {filtered.map((p) => {
              const noGeo = p.latitude === null || p.longitude === null;
              const on = sel?.id === p.id;
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => pick(p.id)} aria-current={on || undefined} title={p.title} className={cn('min-h-11 w-full text-left rounded-sm px-3 py-2 border transition-colors', on ? 'bg-paper text-ink border-paper' : 'border-transparent hover:bg-paper/5')} data-testid={`row-project-${p.id}`}>
                    <span className="flex items-start justify-between gap-2"><span className="text-sm font-medium leading-snug">{p.title}</span>{noGeo && <MapPinOff className="h-3.5 w-3.5 shrink-0 opacity-60" aria-label="No map coordinates" />}</span>
                    <span className={cn('block meta', on ? 'text-ink/60' : 'text-paper/50')}>{p.organizationName} · {p.locationName || 'Location not stated'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </Page>
  );
}
