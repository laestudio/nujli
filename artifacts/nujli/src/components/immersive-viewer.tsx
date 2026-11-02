import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Compass, Images, ListTree } from 'lucide-react';
import type { Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';
import type { Claim, EvidenceComparison, ImmersiveHotspot, ImmersiveScene, Media, Project } from '@workspace/api-client-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { ClaimLabelBadge } from '@/components/states';
import { cn } from '@/lib/utils';
import { MediaContextNote, MediaVideo } from '@/components/media-video';
import { fmtDate, hostOf } from '@/lib/format';

type Detail = { hotspot: ImmersiveHotspot; scene: ImmersiveScene | null };

function SrcLink({ url }: { url: string }) {
  if (!url) return <span className="meta text-paper/60">Source missing</span>;
  return <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-mono text-[0.72rem] underline decoration-vermilion/60 underline-offset-2 break-all" data-testid="link-viewer-source">{hostOf(url)}<ArrowUpRight className="h-3 w-3" aria-hidden /></a>;
}

function usePrefersReducedMotion() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const fn = () => setR(mq.matches);
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, []);
  return r;
}

/** Renders a real equirectangular panorama. Refuses anything not 2:1 once loaded. */
function PanoramaStage({ media, hotspots, label, onSelect, reduced }: { media: Media; hotspots: ImmersiveHotspot[]; label: (h: ImmersiveHotspot) => string; onSelect: (h: ImmersiveHotspot) => void; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [state, setState] = useState<'checking' | 'ok' | 'error'>('checking');
  const [err, setErr] = useState('');
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const hsRef = useRef(hotspots); hsRef.current = hotspots;
  const labelRef = useRef(label); labelRef.current = label;
  const hsKey = hotspots.map((h) => `${h.id}:${h.x}:${h.y}`).join('|');

  useEffect(() => {
    setState('checking'); setErr('');
    let cancelled = false;
    let viewer: Viewer | null = null;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      if (cancelled) return;
      const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
      if (Math.abs(ratio - 2) > 0.02) { setState('error'); setErr(`This image loaded at ${img.naturalWidth} x ${img.naturalHeight}, which is not a 2:1 equirectangular panorama. It is not shown in 360.`); return; }
      if (!ref.current) return;
      try {
        const [{ Viewer }, { MarkersPlugin }] = await Promise.all([
          import('@photo-sphere-viewer/core'), import('@photo-sphere-viewer/markers-plugin'),
        ]);
        if (cancelled || !ref.current) return;
        viewer = new Viewer({
          container: ref.current,
          panorama: media.url,
          // Source captions are rendered as React text below, never as viewer HTML.
          navbar: ['zoom', 'move', 'fullscreen'],
          moveInertia: !reduced,
          keyboard: false,
          plugins: [[MarkersPlugin, {
            markers: hsRef.current.map((h) => ({
              id: h.id,
              position: { yaw: (h.x / 100) * 2 * Math.PI - Math.PI, pitch: Math.PI / 2 - (h.y / 100) * Math.PI },
              html: '<span class="nj-hs" aria-hidden="true"></span>',
              size: { width: 28, height: 28 },
              anchor: 'center center',
              tooltip: labelRef.current(h).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!),
            })),
          }]],
        });
        viewerRef.current = viewer;
        const markers = viewer.getPlugin(MarkersPlugin);
        markers.addEventListener('select-marker', (e) => { const h = hsRef.current.find((x) => x.id === e.marker.id); if (h) onSelectRef.current(h); });
        viewer.addEventListener('panorama-error', () => { setState('error'); setErr('The panorama could not be rendered.'); });
        setState('ok');
      } catch { setState('error'); setErr('The panorama viewer could not start in this browser.'); }
    };
    img.onerror = () => { if (!cancelled) { setState('error'); setErr('The panorama file could not be loaded from its source.'); } };
    img.src = media.url;
    return () => { cancelled = true; viewerRef.current = null; try { viewer?.destroy(); } catch { /* ignore */ } };
  }, [media.url, media.caption, reduced, hsKey]);

  return (
    <div className="relative aspect-[16/10] md:aspect-[21/9] w-full bg-ink overflow-hidden" data-testid="stage-panorama">
      <div ref={ref} className="absolute inset-0" tabIndex={0}
        onKeyDown={e => {
          if (e.target !== e.currentTarget || !viewerRef.current || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
          e.preventDefault();
          const p = viewerRef.current.getPosition();
          viewerRef.current.rotate({ yaw: p.yaw + (e.key === 'ArrowRight' ? 0.1 : e.key === 'ArrowLeft' ? -0.1 : 0),
            pitch: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, p.pitch + (e.key === 'ArrowUp' ? 0.1 : e.key === 'ArrowDown' ? -0.1 : 0))) });
        }}
        aria-label={`360 panorama: ${media.caption || 'project panorama'}. Use arrow keys to look around, or use the evidence list.`} role="group" />
      {state === 'checking' && <div className="absolute inset-0 grid place-items-center meta text-paper/60">Checking panorama dimensions</div>}
      {state === 'error' && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-paper/80" role="alert" data-testid="text-panorama-error">{err}<br />The evidence list below remains available.</div>}
    </div>
  );
}

export function ImmersiveViewer({ project, media, claims, mapHref = '/explore' }: { project: Project; media: Media[]; claims: Claim[]; mapHref?: string }) {
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  const approved = useMemo(() => media.filter((m) => m.permissionStatus === 'approved'), [media]);
  const mediaById = useMemo(() => new Map(approved.map((m) => [m.id, m])), [approved]);
  const claimById = useMemo(() => new Map(claims.map((c) => [c.id, c])), [claims]);
  const scenes = project.immersion?.scenes ?? [];
  const sceneByMedia = useMemo(() => new Map(scenes.map((s) => [s.mediaId, s])), [scenes]);
  const validHotspots = (s: ImmersiveScene | undefined) => (s?.hotspots ?? []).filter((h) => h.confirmed && (h.kind === 'claim' ? claimById.has(h.recordId) : mediaById.has(h.recordId)));
  const panoScenes = scenes.filter((s) => s.panoramaConfirmed && mediaById.get(s.mediaId)?.type === 'image');
  const mode: 'A' | 'B' | 'C' = panoScenes.length ? 'A' : approved.length ? 'B' : 'C';
  const [idx, setIdx] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const detailOpener = useRef<HTMLElement | null>(null);
  const [failedMedia, setFailedMedia] = useState<string | null>(null);

  const items: Media[] = mode === 'A' ? panoScenes.map((s) => mediaById.get(s.mediaId)!) : approved;
  const i = Math.min(idx, Math.max(0, items.length - 1));
  const current = items[i];
  const scene = current ? sceneByMedia.get(current.id) : undefined;
  const hs = validHotspots(scene);
  const go = (d: number) => items.length && setIdx((i + d + items.length) % items.length);

  const labelOf = (h: ImmersiveHotspot) => h.kind === 'claim' ? `Claim: ${(claimById.get(h.recordId)?.text ?? '').slice(0, 80)}` : `Media: ${mediaById.get(h.recordId)?.caption || 'untitled media'}`;

  const comparisons = (project.immersion?.comparisons ?? []).filter((c: EvidenceComparison) => {
    const b = sceneByMedia.get(c.beforeMediaId); const a = sceneByMedia.get(c.afterMediaId);
    return c.confirmed && mediaById.get(c.beforeMediaId)?.type === 'image' && mediaById.get(c.afterMediaId)?.type === 'image' && claimById.has(c.claimId) && !!b?.date && !!a?.date && !!b.dateQuote && !!a.dateQuote;
  });

  if (mode === 'C') {
    return (
      <section aria-label="Project viewer" className="keep-dark bg-ink text-paper border-b border-paper/10" data-testid="viewer-evidence-mode">
        <div className="mx-auto max-w-6xl px-5 py-6 flex flex-wrap items-center gap-4">
          <Link href={mapHref} className="btn-outline min-h-11 px-3 text-sm" data-testid="link-viewer-back-map"><ArrowLeft className="h-4 w-4" />Back to map</Link>
          <p className="text-sm text-paper/70">No permitted media for this view. The documented evidence is listed below.</p>
        </div>
      </section>
    );
  }

  const claimDetail = detail?.hotspot.kind === 'claim' ? claimById.get(detail.hotspot.recordId) : undefined;
  const mediaDetail = detail?.hotspot.kind === 'media' ? mediaById.get(detail.hotspot.recordId) : undefined;
  const mediaDetailScene = mediaDetail ? sceneByMedia.get(mediaDetail.id) : undefined;

  return (
    <section aria-label={mode === 'A' ? '360 evidence viewer' : 'Photo journey'} className="keep-dark bg-ink text-paper border-b border-paper/10" data-testid={`viewer-mode-${mode}`}>
      <div className="mx-auto max-w-6xl px-5 pt-5 pb-3 flex flex-wrap items-center gap-3">
        <Link href={mapHref} className="btn-outline min-h-11 px-3 text-sm" data-testid="link-viewer-back-map"><ArrowLeft className="h-4 w-4" />Back to map</Link>
        <span className="meta inline-flex items-center gap-1.5 text-paper/80" data-testid="text-viewer-mode">
          {mode === 'A' ? <><Compass className="h-3.5 w-3.5 text-vermilion" />360 panorama, confirmed by organization</> : <><Images className="h-3.5 w-3.5 text-vermilion" />Photo journey / ordinary media</>}
        </span>
        <span className="meta text-paper/50 sm:ml-auto">{i + 1} / {items.length}</span>
      </div>
      {mode === 'B' && <p className="mx-auto max-w-6xl px-5 pb-3 text-xs text-paper/60">These are ordinary photos and videos shown in sequence. This is not a 360 view or a reconstruction of the location.</p>}

      <div className="mx-auto max-w-6xl px-5">
        {current && mode === 'A' && (
          <PanoramaStage key={current.id} media={current} hotspots={hs} label={labelOf} reduced={reduced} onSelect={(h) => setDetail({ hotspot: h, scene: scene ?? null })} />
        )}
        {current && mode === 'B' && (
          <div
            className="relative bg-ink-2 overflow-hidden grid place-items-center min-h-[240px]"
            tabIndex={0}
            role="group"
            aria-roledescription="slide"
            aria-label={`Item ${i + 1} of ${items.length}: ${current.caption || current.type}. Left and right arrow keys move between items.`}
            onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } }}
            data-testid="stage-journey"
          >
            {current.type === 'image' ? (
              <div className="relative inline-block max-w-full">
                <img src={current.url} alt={current.caption || 'Project photo'} onError={() => setFailedMedia(current.id)} className="block max-h-[68vh] max-w-full object-contain" />
                {hs.map((h) => (
                  <button key={h.id} type="button" onClick={() => setDetail({ hotspot: h, scene: scene ?? null })} style={{ left: `${h.x}%`, top: `${h.y}%` }} className="nj-hs-btn absolute -translate-x-1/2 -translate-y-1/2" aria-label={`Open evidence. ${labelOf(h)}`} data-testid={`button-hotspot-${h.id}`}><span className="nj-hs" aria-hidden /></button>
                ))}
              </div>
            ) : (
              <MediaVideo key={current.id} url={current.url} sourceUrl={current.sourceUrl} title={current.caption || 'Project video'} dark className="w-full max-w-4xl" testId={`video-journey-${current.id}`} />
            )}
            {failedMedia === current.id && <p role="alert" className="absolute inset-x-0 bottom-0 bg-ink/90 p-4 text-sm">This media could not be loaded. Its source and evidence list remain available.</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 py-3 text-sm">
          <button type="button" onClick={() => go(-1)} disabled={items.length < 2} className="btn-outline min-h-11 px-4 text-sm" aria-label="Previous item" data-testid="button-viewer-prev"><ChevronLeft className="h-4 w-4" />Previous</button>
          <button type="button" onClick={() => go(1)} disabled={items.length < 2} className="btn-outline min-h-11 px-4 text-sm" aria-label="Next item" data-testid="button-viewer-next">Next<ChevronRight className="h-4 w-4" /></button>
          <div className="min-w-0 basis-full sm:basis-auto flex-1 text-paper/80 [overflow-wrap:anywhere]">
            <span className="line-clamp-2">{current?.caption || 'Untitled'}</span>
            <span className="meta text-paper/50">{project.organizationName} · {scene?.date ? `Recorded ${fmtDate(scene.date)}` : 'Undated'}{mode === 'B' ? ' · not 360' : ''}</span>
            {current && (
              <details className="mt-1" data-testid="details-viewer-context">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs font-medium underline underline-offset-4">Context and source</summary>
                <div className="pb-2"><MediaContextNote caption={current.caption} permission={current.permissionStatus} dark /><p className="mt-1 text-xs text-paper/60">White and silver rings mark confirmed evidence points; each opens its source and limitations.</p></div>
              </details>
            )}
          </div>
          {current && <SrcLink url={current.sourceUrl} />}
        </div>

        <div className="border-t border-paper/10 py-4" aria-label="Evidence in this view">
          <p className="meta text-paper/55 inline-flex items-center gap-1.5"><ListTree className="h-3.5 w-3.5" />Evidence in this view (list alternative)</p>
          {hs.length === 0 ? <p className="mt-2 text-sm text-paper/60">No confirmed evidence points on this item.</p> : (
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {hs.map((h) => (
                <li key={h.id}><button type="button" onClick={() => setDetail({ hotspot: h, scene: scene ?? null })} className="w-full min-h-11 text-left text-sm py-1.5 px-2 rounded-sm hover:bg-paper/10 inline-flex items-center gap-2" data-testid={`button-hotspot-list-${h.id}`}><span className="nj-hs nj-hs-sm shrink-0" aria-hidden />{labelOf(h)}</button></li>
              ))}
            </ul>
          )}
        </div>

        {comparisons.length > 0 && (
          <div className="border-t border-paper/10 py-6 space-y-6" data-testid="section-comparisons">
            <p className="meta text-paper/55">Before and after, recorded dates</p>
            {comparisons.map((c) => {
              const b = mediaById.get(c.beforeMediaId)!; const a = mediaById.get(c.afterMediaId)!; const cl = claimById.get(c.claimId)!;
              return (
                <figure key={`${c.beforeMediaId}-${c.afterMediaId}-${c.claimId}`}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[b, a].map((m, k) => (
                      <div key={m.id}>
                        <img src={m.url} alt={m.caption || (k ? 'After' : 'Before')} className="w-full object-cover aspect-[4/3]" />
                        <p className="mt-1.5 meta text-paper/70">{k ? 'After' : 'Before'}: recorded {fmtDate(sceneByMedia.get(m.id)?.date)}</p>
                        <p className="text-xs italic text-paper/55">"{sceneByMedia.get(m.id)?.dateQuote}"</p>
                        <SrcLink url={m.sourceUrl} />
                      </div>
                    ))}
                  </div>
                  <figcaption className="mt-3 text-sm text-paper/80">
                    <span className="mr-2"><ClaimLabelBadge label={cl.label} /></span>{cl.text}
                    <span className="block mt-1"><SrcLink url={cl.sourceUrl} /></span>
                    <span className="block mt-1 text-xs text-paper/50">Dates show when each image was recorded according to its source. This comparison does not show financial impact or attribute change to any donation.</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className={cn('keep-dark bg-ink text-paper border-paper/15 overflow-y-auto', isMobile && 'max-h-[85dvh] rounded-t-md')} data-testid="sheet-hotspot-detail"
          onOpenAutoFocus={() => {
            const active = document.activeElement;
            detailOpener.current = active instanceof HTMLElement && active !== document.body ? active : null;
          }}
          onCloseAutoFocus={(event) => {
            const opener = detailOpener.current;
            if (opener?.isConnected) { event.preventDefault(); opener.focus(); }
            detailOpener.current = null;
          }}>
          <SheetTitle className="font-display text-xl text-paper">{detail?.hotspot.kind === 'claim' ? 'Documented claim' : 'Documented media'}</SheetTitle>
          <SheetDescription className="text-paper/60 text-sm">{project.organizationName} / {project.title || 'Untitled project'}</SheetDescription>
          {detail && (
            <div className="mt-5 space-y-4 text-sm">
              {claimDetail && (
                <>
                  <ClaimLabelBadge label={claimDetail.label} />
                  <p className="text-base">{claimDetail.text}</p>
                  <blockquote className="border-l-2 border-vermilion pl-3 italic text-paper/75">{claimDetail.quote}</blockquote>
                  <p className="meta text-paper/55">Event date: undated. First published: {claimDetail.publishedAt ? fmtDate(claimDetail.publishedAt) : 'unknown'}.</p>
                  <SrcLink url={claimDetail.sourceUrl} />
                  {claimDetail.reviews.map((r) => (
                    <div key={r.id} className="raised rounded-sm border border-paper/15 p-3">
                      <p className="meta text-vermilion">Independent review, {fmtDate(r.createdAt)}</p>
                      <p className="mt-1">{r.findings}</p>
                      <p className="mt-1 text-paper/70"><span className="meta text-paper/50 mr-2">Limitations</span>{r.limitations}</p>
                      <div className="mt-2 flex flex-wrap gap-2">{r.evidenceUrls.map(url => <SrcLink key={url} url={url} />)}</div>
                    </div>
                  ))}
                </>
              )}
              {mediaDetail && (
                <>
                  <span className="meta border border-paper/30 px-2 py-0.5 rounded-sm">Organization Reported</span>
                  {mediaDetail.type === 'image' ? <img src={mediaDetail.url} alt={mediaDetail.caption || 'Media'} className="w-full" /> : <MediaVideo url={mediaDetail.url} sourceUrl={mediaDetail.sourceUrl} title={mediaDetail.caption || 'Media'} dark />}
                  <p>{mediaDetail.caption || 'No caption.'}</p>
                  <MediaContextNote caption={mediaDetail.caption} permission={mediaDetail.permissionStatus} dark />
                  <p className="meta text-paper/55">{mediaDetailScene?.date ? `Recorded ${fmtDate(mediaDetailScene.date)}` : 'Date: undated'}</p>
                  <p className="meta text-paper/55">First published: {mediaDetail.publishedAt ? fmtDate(mediaDetail.publishedAt) : 'unknown'}</p>
                  {mediaDetailScene?.date && <p className="text-xs italic text-paper/60">"{mediaDetailScene.dateQuote}"</p>}
                  <SrcLink url={mediaDetail.sourceUrl} />
                </>
              )}
              <div className="border-t border-paper/10 pt-3"><p className="meta text-paper/50">Limitations</p><p className="mt-1 text-paper/80">{detail.hotspot.limitations}</p></div>
              <button type="button" onClick={() => setDetail(null)} className="btn-outline min-h-11 px-3 text-sm" data-testid="button-close-detail"><ArrowRight className="h-4 w-4" />Back to viewer</button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
