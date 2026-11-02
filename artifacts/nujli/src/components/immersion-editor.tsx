import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { EvidenceComparison, ImmersiveHotspot, ImmersiveScene, Immersion, ProjectRevision } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { uid } from '@/lib/format';

const inputCls = 'w-full min-w-0 rounded-sm border border-input bg-card px-3 py-2 text-sm focus:border-ink';
const EMPTY: Immersion = { scenes: [], comparisons: [] };

function F({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn('block min-w-0', className)}><span className="meta text-ink/60">{label}</span><div className="mt-1">{children}</div></label>;
}

/** Revoke every confirmation that depends on a media item. */
export function revokeMedia(imm: Immersion | undefined, mediaId: string): Immersion | undefined {
  if (!imm) return imm;
  return {
    scenes: imm.scenes.map((s) => ({
      ...s,
      panoramaConfirmed: s.mediaId === mediaId ? false : s.panoramaConfirmed,
      hotspots: s.hotspots.map((h) => (s.mediaId === mediaId || (h.kind === 'media' && h.recordId === mediaId) ? { ...h, confirmed: false } : h)),
    })),
    comparisons: imm.comparisons.map((c) => (c.beforeMediaId === mediaId || c.afterMediaId === mediaId ? { ...c, confirmed: false } : c)),
  };
}

/** Revoke confirmations that depend on a claim. */
export function revokeClaim(imm: Immersion | undefined, claimId: string): Immersion | undefined {
  if (!imm) return imm;
  return {
    scenes: imm.scenes.map((s) => ({ ...s, hotspots: s.hotspots.map((h) => (h.kind === 'claim' && h.recordId === claimId ? { ...h, confirmed: false } : h)) })),
    comparisons: imm.comparisons.map((c) => (c.claimId === claimId ? { ...c, confirmed: false } : c)),
  };
}

/** Drop references to removed records. */
export function pruneImmersion(imm: Immersion | undefined, mediaIds: Set<string>, claimIds: Set<string>): Immersion | undefined {
  if (!imm) return imm;
  return {
    scenes: imm.scenes.filter((s) => mediaIds.has(s.mediaId)).map((s) => ({ ...s, hotspots: s.hotspots.filter((h) => (h.kind === 'claim' ? claimIds.has(h.recordId) : mediaIds.has(h.recordId))) })),
    comparisons: imm.comparisons.filter((c) => mediaIds.has(c.beforeMediaId) && mediaIds.has(c.afterMediaId) && claimIds.has(c.claimId)),
  };
}

export function immersionProblems(r: ProjectRevision): string[] {
  const out: string[] = [];
  (r.immersion?.scenes ?? []).forEach((s, i) => {
    if (s.date && !s.dateQuote.trim()) out.push(`Scene ${i + 1} needs the verbatim source text that states its date.`);
    s.hotspots.forEach((h, j) => { if (h.limitations.trim().length < 10) out.push(`Scene ${i + 1} hotspot ${j + 1} needs limitations (at least 10 characters).`); });
  });
  (r.immersion?.comparisons ?? []).forEach((c, i) => { if (!c.beforeMediaId || !c.afterMediaId || !c.claimId || c.beforeMediaId === c.afterMediaId) out.push(`Comparison ${i + 1} needs two different scenes and a claim.`); });
  return out;
}

export function ImmersionEditor({ r, set }: { r: ProjectRevision; set: (patch: Partial<ProjectRevision>) => void }) {
  const imm = r.immersion ?? EMPTY;
  const put = (next: Immersion) => set({ immersion: next });
  const mediaLabel = (id: string) => { const i = r.media.findIndex((m) => m.id === id); const m = r.media[i]; return m ? `Media ${i + 1}: ${m.caption || m.type}` : 'Missing media'; };
  const unused = r.media.filter((m) => !imm.scenes.some((s) => s.mediaId === m.id));
  const setScene = (i: number, patch: Partial<ImmersiveScene>, revokeComparisons = false) => {
    const scenes = imm.scenes.map((s, k) => (k === i ? { ...s, ...patch } : s));
    const mid = imm.scenes[i].mediaId;
    put({ scenes, comparisons: revokeComparisons ? imm.comparisons.map((c) => (c.beforeMediaId === mid || c.afterMediaId === mid ? { ...c, confirmed: false } : c)) : imm.comparisons });
  };
  const setHotspot = (i: number, hid: string, patch: Partial<ImmersiveHotspot>) =>
    setScene(i, { hotspots: imm.scenes[i].hotspots.map((h) => (h.id === hid ? { ...h, ...patch, confirmed: 'confirmed' in patch ? !!patch.confirmed : false } : h)) });
  const setCmp = (i: number, patch: Partial<EvidenceComparison>) =>
    put({ ...imm, comparisons: imm.comparisons.map((c, k) => (k === i ? { ...c, ...patch, confirmed: 'confirmed' in patch ? !!patch.confirmed : false } : c)) });
  const datedScenes = imm.scenes.filter((s) => s.date && r.media.find((m) => m.id === s.mediaId)?.type === 'image');
  const clamp = (v: string) => Math.min(100, Math.max(0, Number.isNaN(Number(v)) ? 0 : Number(v)));

  return (
    <section className="border-t border-ink/10 pt-8" data-testid="section-immersion-editor">
      <h3 className="font-display text-xl font-semibold">Immersive viewer <span className="meta text-ink/50 ml-1">{imm.scenes.length}/50</span></h3>
      <p className="mt-2 text-sm text-ink/70 max-w-3xl">Arrange your existing media into scenes. A scene appears in 360 only if you confirm it is a genuine equirectangular panorama; otherwise permitted media appears as an ordinary photo journey. Evidence points must link to an existing claim or media item, and each needs your confirmation. Nothing here is approved automatically.</p>
      <p className="mt-2 text-sm border-l-2 border-vermilion pl-3">Editing a media item or claim revokes confirmations that depend on it. Save those corrections first, then return here to reconfirm.</p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <F label="Add scene from existing media" className="min-w-[240px]">
          <select className={inputCls} value="" onChange={(e) => e.target.value && put({ ...imm, scenes: [...imm.scenes, { mediaId: e.target.value, panoramaConfirmed: false, date: null, dateQuote: '', hotspots: [] }] })} disabled={unused.length === 0 || imm.scenes.length >= 50} data-testid="select-add-scene">
            <option value="">{unused.length ? 'Choose media' : 'All media already used'}</option>
            {unused.map((m) => <option key={m.id} value={m.id}>{mediaLabel(m.id)}</option>)}
          </select>
        </F>
      </div>

      <div className="mt-4 space-y-4">
        {imm.scenes.map((s, i) => {
          const m = r.media.find((x) => x.id === s.mediaId);
          return (
            <div key={s.mediaId} className="relative rounded-md border border-ink/15 bg-card p-4 pr-12" data-testid={`card-scene-${i}`}>
              <button type="button" onClick={() => put({ scenes: imm.scenes.filter((_, k) => k !== i), comparisons: imm.comparisons.filter((c) => c.beforeMediaId !== s.mediaId && c.afterMediaId !== s.mediaId) })} aria-label={`Remove scene ${i + 1}`} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-sm text-ink/60 hover:bg-vermilion hover:text-white" data-testid={`button-remove-scene-${i}`}><Trash2 className="h-4 w-4" /></button>
              <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                <div className="relative aspect-[2/1] rounded-sm bg-ink/5 overflow-hidden">
                  {m?.type === 'image' && m.url ? <img src={m.url} alt={m.caption || 'Scene'} className="h-full w-full object-cover" /> : <span className="meta text-ink/50 grid h-full place-items-center">{m?.type ?? 'missing'}</span>}
                  {s.hotspots.map((h) => <span key={h.id} className="nj-hs nj-hs-sm absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${h.x}%`, top: `${h.y}%` }} aria-hidden />)}
                </div>
                <div className="space-y-3 min-w-0">
                  <p className="meta text-ink/60">Scene {i + 1} / {mediaLabel(s.mediaId)} / {m?.permissionStatus}</p>
                  {m?.type === 'image' && (
                    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#D42A2F]" checked={s.panoramaConfirmed} onChange={(e) => setScene(i, { panoramaConfirmed: e.target.checked })} data-testid={`checkbox-panorama-${i}`} /><span>I confirm this is a genuine 360 equirectangular panorama captured as one. A wide photo is not a panorama.</span></label>
                  )}
                  <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                    <F label="Recorded date (blank = undated)"><input type="date" className={cn(inputCls, 'font-mono')} value={s.date ? s.date.slice(0, 10) : ''} onChange={(e) => setScene(i, { date: e.target.value || null }, true)} data-testid={`input-scene-date-${i}`} /></F>
                    <F label="Verbatim text from the media source stating the date"><input className={inputCls} maxLength={4000} value={s.dateQuote} onChange={(e) => setScene(i, { dateQuote: e.target.value }, true)} data-testid={`input-scene-quote-${i}`} /></F>
                  </div>

                  <div className="space-y-3">
                    <p className="meta text-ink/60">Evidence points {s.hotspots.length}/40</p>
                    {s.hotspots.map((h, j) => (
                      <div key={h.id} className="rounded-sm border border-ink/10 p-3 grid gap-3 md:grid-cols-6" data-testid={`row-hotspot-${i}-${j}`}>
                        <F label="Kind"><select className={inputCls} value={h.kind} onChange={(e) => setHotspot(i, h.id, { kind: e.target.value as ImmersiveHotspot['kind'], recordId: '' })}><option value="claim">Claim</option><option value="media">Media</option></select></F>
                        <F label="Record" className="md:col-span-3">
                          <select className={inputCls} value={h.recordId} onChange={(e) => setHotspot(i, h.id, { recordId: e.target.value })} data-testid={`select-hotspot-record-${i}-${j}`}>
                            <option value="">Choose</option>
                            {h.kind === 'claim' ? r.claims.map((c, ci) => <option key={c.id} value={c.id}>Claim {ci + 1}: {c.text.slice(0, 50)}</option>) : r.media.map((x) => <option key={x.id} value={x.id}>{mediaLabel(x.id)}</option>)}
                          </select>
                        </F>
                        <F label="X position (0-100)"><input type="number" min={0} max={100} step="0.1" className={cn(inputCls, 'font-mono')} value={h.x} onChange={(e) => setHotspot(i, h.id, { x: clamp(e.target.value) })} data-testid={`input-hotspot-x-${i}-${j}`} /></F>
                        <F label="Y position (0-100)"><input type="number" min={0} max={100} step="0.1" className={cn(inputCls, 'font-mono')} value={h.y} onChange={(e) => setHotspot(i, h.id, { y: clamp(e.target.value) })} data-testid={`input-hotspot-y-${i}-${j}`} /></F>
                        <F label="Limitations (what this does not show)" className="md:col-span-6"><textarea className={inputCls} maxLength={2000} value={h.limitations} onChange={(e) => setHotspot(i, h.id, { limitations: e.target.value })} data-testid={`input-hotspot-limitations-${i}-${j}`} /></F>
                        <div className="md:col-span-6 flex flex-wrap items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#D42A2F]" checked={h.confirmed} disabled={!h.recordId} onChange={(e) => setHotspot(i, h.id, { confirmed: e.target.checked })} data-testid={`checkbox-hotspot-confirm-${i}-${j}`} />I confirm this point matches the linked record and its position</label>
                          <button type="button" onClick={() => setScene(i, { hotspots: s.hotspots.filter((x) => x.id !== h.id) })} className="text-sm text-vermilion-deep inline-flex items-center gap-1" data-testid={`button-remove-hotspot-${i}-${j}`}><Trash2 className="h-3.5 w-3.5" />Remove point</button>
                        </div>
                      </div>
                    ))}
                    <button type="button" disabled={s.hotspots.length >= 40} onClick={() => setScene(i, { hotspots: [...s.hotspots, { id: uid(), kind: 'claim', recordId: '', x: 50, y: 50, confirmed: false, limitations: '' }] })} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-sm border border-ink/25 text-sm disabled:opacity-40" data-testid={`button-add-hotspot-${i}`}><Plus className="h-4 w-4" />Add evidence point</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <h4 className="font-display text-lg font-semibold">Before and after <span className="meta text-ink/50 ml-1">{imm.comparisons.length}/20</span></h4>
        <p className="mt-1 text-sm text-ink/65">Needs two dated image scenes and a claim whose quote states both dates. Shown as recorded dates only, never as financial impact.</p>
        <div className="mt-3 space-y-3">
          {imm.comparisons.map((c, i) => (
            <div key={i} className="rounded-sm border border-ink/15 bg-card p-3 grid gap-3 md:grid-cols-3" data-testid={`row-comparison-${i}`}>
              {(['beforeMediaId', 'afterMediaId'] as const).map((k) => (
                <F key={k} label={k === 'beforeMediaId' ? 'Before scene' : 'After scene'}>
                  <select className={inputCls} value={c[k]} onChange={(e) => setCmp(i, { [k]: e.target.value })}>
                    <option value="">Choose</option>
                    {datedScenes.map((s) => <option key={s.mediaId} value={s.mediaId}>{mediaLabel(s.mediaId)} ({s.date?.slice(0, 10)})</option>)}
                  </select>
                </F>
              ))}
              <F label="Claim quoting both dates">
                <select className={inputCls} value={c.claimId} onChange={(e) => setCmp(i, { claimId: e.target.value })}>
                  <option value="">Choose</option>
                  {r.claims.map((cl, ci) => <option key={cl.id} value={cl.id}>Claim {ci + 1}: {cl.text.slice(0, 50)}</option>)}
                </select>
              </F>
              <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#D42A2F]" checked={c.confirmed} disabled={!c.beforeMediaId || !c.afterMediaId || !c.claimId} onChange={(e) => setCmp(i, { confirmed: e.target.checked })} data-testid={`checkbox-comparison-confirm-${i}`} />I confirm these show the same place at the recorded dates</label>
                <button type="button" onClick={() => put({ ...imm, comparisons: imm.comparisons.filter((_, k) => k !== i) })} className="text-sm text-vermilion-deep inline-flex items-center gap-1" data-testid={`button-remove-comparison-${i}`}><Trash2 className="h-3.5 w-3.5" />Remove</button>
              </div>
            </div>
          ))}
          <button type="button" disabled={datedScenes.length < 2 || imm.comparisons.length >= 20} onClick={() => put({ ...imm, comparisons: [...imm.comparisons, { beforeMediaId: '', afterMediaId: '', claimId: '', confirmed: false }] })} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-sm border border-ink/25 text-sm disabled:opacity-40" title={datedScenes.length < 2 ? 'Requires two dated image scenes' : undefined} data-testid="button-add-comparison"><Plus className="h-4 w-4" />Add comparison</button>
        </div>
      </div>
    </section>
  );
}
