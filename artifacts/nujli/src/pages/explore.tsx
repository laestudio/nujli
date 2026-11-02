import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { DemoNotice } from '@/components/demo-notice';
import { ArrowRight, MapPinOff, Search, X } from 'lucide-react';
import { useGetPublicSummary, useListPublicProjects, getListPublicProjectsQueryKey } from '@workspace/api-client-react';
import type { ListPublicProjectsParams } from '@workspace/api-client-react';
import { Page } from '@/components/shell';
import { WorldMap, type MapMarker } from '@/components/world-map';
import { Block, Empty, ErrorState } from '@/components/states';
import { cn } from '@/lib/utils';
import { fmtDate } from '@/lib/format';

export default function Explore() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [cause, setCause] = useState('');
  const [org, setOrg] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSearch(q.trim()), 300);
    return () => window.clearTimeout(timer.current);
  }, [q]);

  const params = useMemo<ListPublicProjectsParams>(() => ({
    ...(search ? { search } : {}), ...(cause ? { cause } : {}), ...(org ? { organization: org } : {}),
  }), [search, cause, org]);
  const hasFilter = Object.keys(params).length > 0;

  const summary = useGetPublicSummary();
  const all = useListPublicProjects();
  const list = useListPublicProjects(hasFilter ? params : undefined, { query: { queryKey: getListPublicProjectsQueryKey(hasFilter ? params : undefined) } });

  const orgs = useMemo(() => [...new Set((all.data ?? []).map((p) => p.organizationName))].sort(), [all.data]);
  const causes = summary.data?.causes ?? [];
  const projects = list.data ?? [];
  const markers = useMemo<MapMarker[]>(() => projects.filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => ({ id: p.id, lat: p.latitude as number, lng: p.longitude as number, label: p.title })), [projects]);
  const sel = projects.find((p) => p.id === selected) ?? null;

  const pick = (id: string, fly = false) => { setSelected(id); if (fly) setFocus(id); };
  const selectCls = 'h-10 rounded-sm border border-paper/20 bg-ink-2 px-3 text-sm text-paper';

  return (
    <Page dark footer={false}>
      <div className="lg:grid lg:grid-cols-[400px_1fr] lg:h-[calc(100dvh-4rem)]">
        <aside className="flex flex-col border-b lg:border-b-0 lg:border-r border-paper/10 lg:overflow-hidden order-2 lg:order-1">
          <div className="p-5 space-y-3 border-b border-paper/10">
            <h1 className="font-display text-2xl font-bold">Evidence map</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper/50" aria-hidden />
              <label htmlFor="map-search" className="sr-only">Search projects</label>
              <input id="map-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, place, organization" className="h-10 w-full rounded-sm border border-paper/20 bg-ink-2 pl-9 pr-3 text-sm text-paper placeholder:text-paper/45" data-testid="input-search" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="sr-only" htmlFor="f-cause">Cause</label>
              <select id="f-cause" value={cause} onChange={(e) => setCause(e.target.value)} className={selectCls} data-testid="select-cause">
                <option value="">All causes</option>
                {causes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="sr-only" htmlFor="f-org">Organization</label>
              <select id="f-org" value={org} onChange={(e) => setOrg(e.target.value)} className={selectCls} data-testid="select-organization">
                <option value="">All organizations</option>
                {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {hasFilter && (
              <button type="button" onClick={() => { setQ(''); setCause(''); setOrg(''); }} className="inline-flex items-center gap-1 text-xs text-paper/70 hover:text-paper" data-testid="button-clear-filters"><X className="h-3 w-3" />Clear filters</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3" aria-live="polite">
            <p className="meta text-paper/50 px-2 pb-2" data-testid="text-result-count">{list.isLoading ? 'Loading' : `${projects.length} project${projects.length === 1 ? '' : 's'}`}</p>
            {list.isLoading && <div className="space-y-2 px-2">{[0, 1, 2].map((i) => <Block key={i} className="h-16 bg-paper/10" />)}</div>}
            {list.isError && <div className="px-2 text-ink"><ErrorState error={list.error} onRetry={() => list.refetch()} /></div>}
            {!list.isLoading && !list.isError && projects.length === 0 && (
              <div className="px-2">
                <Empty dark kicker={hasFilter ? 'No match' : 'Nothing published yet'} title={hasFilter ? 'No published project matches.' : 'The map is honestly empty.'}>
                  {hasFilter ? 'Try a broader search or clear the filters.' : 'Pins appear only when an organization approves and publishes a real Impact Page. There are no placeholders.'}
                </Empty>
              </div>
            )}
            <ul className="space-y-1" role="list">
              {projects.map((p) => {
                const noGeo = p.latitude === null || p.longitude === null;
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => pick(p.id, !noGeo)} aria-current={selected === p.id} className={cn('w-full text-left rounded-sm px-3 py-3 transition-colors border', selected === p.id ? 'bg-paper text-ink border-paper' : 'border-transparent hover:bg-paper/5')} data-testid={`row-project-${p.id}`}>
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-medium leading-snug">{p.title}</span>
                        {noGeo && <MapPinOff className="h-3.5 w-3.5 shrink-0 opacity-60" aria-label="No coordinates" />}
                      </span>
                      <span className={cn('mt-1 block meta', selected === p.id ? 'text-ink/60' : 'text-paper/50')}>{p.organizationName} / {p.cause || 'No cause'} / {p.locationName || 'Location not stated'}</span>
                      {p.demonstration && <span className="mt-2 block text-xs">Independent public-data demonstration</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
        <div className="relative h-[62dvh] lg:h-full order-1 lg:order-2">
          <WorldMap markers={markers} selectedId={selected} focusId={focus} onSelect={(id) => pick(id)} className="absolute inset-0" />
          {sel && (
            <div className="absolute left-3 right-3 bottom-3 sm:left-auto sm:right-16 sm:w-[360px] rounded-md invert-surface bg-paper-2 border border-ink/15 text-ink p-5 shadow-2xl rise" style={sel.demonstration ? {maxHeight:"calc(100% - 1.5rem)",overflowY:"auto"} : undefined} role="dialog" aria-label={`Preview: ${sel.title}`} data-testid="card-preview">
              <button type="button" onClick={() => setSelected(null)} aria-label="Close preview" className="absolute right-3 top-3 text-ink/60 hover:text-ink" data-testid="button-close-preview"><X className="h-4 w-4" /></button>
              <p className="meta text-vermilion-deep">{sel.cause || 'Cause not stated'}</p>
              <h2 className="mt-2 font-display text-xl font-bold leading-tight pr-6">{sel.title}</h2>
              <p className="mt-1 text-sm text-ink/70">{sel.organizationName}{sel.locationName ? `, ${sel.locationName}` : ''}</p>
              <DemoNotice demonstration={sel.demonstration} />
              <p className="mt-3 text-sm text-ink/80 line-clamp-3">{sel.overview}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-ink/10 pt-3 text-center">
                <div><dt className="meta text-ink/50">Stats</dt><dd className="font-display font-bold">{sel.statistics.length}</dd></div>
                <div><dt className="meta text-ink/50">Updates</dt><dd className="font-display font-bold">{sel.updates.length}</dd></div>
                <div><dt className="meta text-ink/50">Claims</dt><dd className="font-display font-bold">{sel.claims.length}</dd></div>
              </dl>
              <div className="mt-4 flex items-center justify-between">
                <span className="meta text-ink/50">{sel.publishedAt ? `Published ${fmtDate(sel.publishedAt)}` : ''}</span>
                <Link href={`/projects/${sel.id}`} className="inline-flex items-center gap-1.5 bg-ink text-paper px-3.5 py-2 rounded-sm text-sm font-medium hover:bg-vermilion hover:text-white transition-colors" data-testid="link-open-project">Open page <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
