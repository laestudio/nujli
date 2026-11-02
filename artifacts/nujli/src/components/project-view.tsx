import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CalendarClock, ChevronDown, ImageOff, MapPin, Quote, VideoOff, X } from 'lucide-react';
import type { Claim, Media, Project, Statistic } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { fmtDate, hostOf, isoDay } from '@/lib/format';
import { ClaimLabelBadge, Empty, Kicker, StatusPill } from '@/components/states';
import { DemoNotice } from '@/components/demo-notice';

const SINCE_KEY = 'nujli:last-donation';

function Source({ url, className }: { url: string; className?: string }) {
  if (!url) return <span className={cn('meta text-vermilion-deep', className)}>Source missing</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className={cn('inline-flex items-center gap-1 font-mono text-[0.72rem] underline decoration-vermilion/60 underline-offset-2 hover:decoration-vermilion break-all', className)} data-testid="link-source">
      {hostOf(url)} <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
    </a>
  );
}

function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) { const v = u.searchParams.get('v'); return v ? `https://www.youtube-nocookie.com/embed/${v}` : null; }
    if (u.hostname === 'youtu.be') return `https://www.youtube-nocookie.com/embed${u.pathname}`;
    if (u.hostname.includes('vimeo.com')) { const id = u.pathname.split('/').filter(Boolean).pop(); return id ? `https://player.vimeo.com/video/${id}` : null; }
  } catch { return null; }
  return null;
}

function Section({ id, kicker, title, children, aside }: { id: string; kicker: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="py-10 border-t border-ink/10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <Kicker className="text-ink/55">{kicker}</Kicker>
          <h2 id={`${id}-h`} className="mt-2 font-display text-2xl md:text-3xl font-semibold">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function ProjectView({ project, preview = false }: { project: Project; preview?: boolean }) {
  const [since, setSince] = useState<string>(() => (preview ? '' : localStorage.getItem(SINCE_KEY) ?? ''));
  const [openUpdate, setOpenUpdate] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Media | null>(null);
  const [openQuote, setOpenQuote] = useState<string | null>(null);

  useEffect(() => {
    if (preview) return;
    if (since) localStorage.setItem(SINCE_KEY, since); else localStorage.removeItem(SINCE_KEY);
  }, [since, preview]);

  const claimById = useMemo(() => new Map<string, Claim>(project.claims.map((c) => [c.id, c])), [project.claims]);
  const visibleMedia = useMemo(() => project.media.filter((m) => preview || m.permissionStatus === 'approved'), [project.media, preview]);
  const images = visibleMedia.filter((m) => m.type === 'image');
  const videos = visibleMedia.filter((m) => m.type === 'video');
  const updates = useMemo(() => [...project.updates].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [project.updates]);

  const isNewStat = (s: Statistic) => !!since && !!isoDay(s.asOf) && isoDay(s.asOf)! >= since;
  const filteredUpdates = since ? updates.filter((u) => (isoDay(u.date) ?? '') >= since) : updates;
  const stats = since ? project.statistics.filter(isNewStat) : project.statistics;
  const undatedHidden = since ? project.statistics.filter((s) => !isoDay(s.asOf)).length : 0;

  return (
    <article className={cn("text-ink", project.demonstration && "[overflow-wrap:anywhere]")} data-testid={`view-project-${project.id}`}>
      {/* Header */}
      <header className="keep-dark relative overflow-hidden bg-ink-2 text-paper border-b border-paper/10">
        <div className="absolute inset-0 opacity-[0.07]" aria-hidden style={{ backgroundImage: 'radial-gradient(#F3ECDD 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
        <div className="relative mx-auto max-w-6xl px-5 pt-14 pb-12">
          <div className="flex flex-wrap items-center gap-3">
            {project.cause && <span className="meta text-vermilion">{project.cause}</span>}
            {preview && <StatusPill status={project.status} />}
            {project.isSample && <span className="meta border border-paper/30 px-2 py-0.5 rounded-sm">Sample record</span>}
          </div>
          <h1 className="mt-4 font-display text-4xl md:text-6xl font-bold leading-[0.98] tracking-tight max-w-4xl" data-testid="text-project-title">{project.title || 'Untitled project'}</h1>
          <DemoNotice demonstration={project.demonstration} />
          {project.demonstration && <p className="text-sm">Traditional Evidence View · IATI activity {project.demonstration.activityId} · Source updated {fmtDate(project.demonstration.sourceUpdatedAt)}. No reported result indicators are attached; financial transactions are not evidence of delivered outcomes.</p>}
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm text-paper/75">
            <span data-testid="text-organization">{project.organizationName}</span>
            {project.locationName && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-vermilion" />{project.locationName}</span>}
            {project.publishedAt && <span className="meta self-center">Published {fmtDate(project.publishedAt)}</span>}
            <span className="meta self-center">Updated {fmtDate(project.updatedAt)}</span>
          </div>
          <div className="mt-5 text-paper/70 text-sm">Original public page: <Source url={project.sourceUrl} className="text-paper" /></div>
        </div>
      </header>

      {/* Since filter */}
      <div className="sticky top-16 z-30 border-b border-ink/10 bg-paper/92 backdrop-blur">
        <div className="mx-auto max-w-6xl px-5 py-3 flex flex-wrap items-center gap-3">
          <CalendarClock className="h-4 w-4 text-vermilion-deep" aria-hidden />
          <label htmlFor="since" className="text-sm font-medium">Since your last donation</label>
          <input id="since" type="date" value={since} onChange={(e) => setSince(e.target.value)} className="h-9 rounded-sm border border-ink/25 bg-paper px-2 font-mono text-sm" data-testid="input-since-date" />
          {since && (
            <button type="button" onClick={() => setSince('')} className="inline-flex items-center gap-1 text-sm underline underline-offset-2" data-testid="button-clear-since"><X className="h-3.5 w-3.5" />Show everything</button>
          )}
          <p className="meta text-ink/60 w-full sm:w-auto sm:ml-auto" aria-live="polite" data-testid="text-since-summary">
            {since ? `${filteredUpdates.length} updates, ${stats.length} dated statistics since ${fmtDate(since)}` : 'Showing full record'}
          </p>
        </div>
        <nav aria-label="Project sections" className="mx-auto max-w-6xl px-5 pb-2 flex gap-4 overflow-x-auto meta text-ink/60">
          {['overview', 'statistics', 'gallery', 'video', 'timeline', 'evidence'].map((s) => <a key={s} href={`#${s}`} className="hover:text-ink whitespace-nowrap">{s}</a>)}
        </nav>
      </div>

      <div className="mx-auto max-w-6xl px-5">
        {preview && project.warnings.length > 0 && (
          <div className="mt-8 border border-vermilion/60 bg-vermilion/5 rounded-md p-4" role="note">
            <p className="meta text-vermilion-deep">Generation warnings</p>
            <ul className="mt-2 list-disc pl-5 text-sm space-y-1">{project.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}

        <Section id="overview" kicker="01" title="Overview">
          {project.overview ? (
            <p className="max-w-3xl text-lg leading-relaxed whitespace-pre-line text-ink/85" data-testid="text-overview">{project.overview}</p>
          ) : <Empty title="No overview was extracted." kicker="Overview">The source page did not provide a description we could quote.</Empty>}
        </Section>

        <Section id="statistics" kicker="02" title="Source-linked statistics" aside={since && undatedHidden > 0 ? <p className="meta text-ink/55">{undatedHidden} undated statistic{undatedHidden === 1 ? '' : 's'} not counted as new</p> : undefined}>
          {stats.length === 0 ? (
            <Empty kicker="Statistics" title={since ? 'No dated statistics since that date.' : 'No statistics with a quotable source.'}>
              {since ? 'Statistics without an as-of date are never treated as new.' : 'Figures appear here only when the original page states them and the quote is preserved.'}
            </Empty>
          ) : (
            <div className="grid gap-px bg-ink/10 border border-ink/10 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((s) => {
                const claim = claimById.get(s.claimId);
                return (
                  <div key={s.id} className={cn('bg-paper p-5 flex flex-col', isNewStat(s) && 'bg-vermilion/15')} data-testid={`card-stat-${s.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="meta text-ink/55">{s.asOf ? `As of ${fmtDate(s.asOf)}` : 'Undated'}</span>
                      {claim && <ClaimLabelBadge label={claim.label} />}
                    </div>
                    <p className="mt-4 font-display text-4xl font-bold tracking-tight">{s.value}<span className="ml-1 text-lg font-medium text-ink/60">{s.unit}</span></p>
                    <p className="mt-1 text-sm font-medium">{project.demonstration && s.label === "budget" ? "Reported budget (not actual spending)" : s.label}</p>
                    <div className="mt-auto pt-4 space-y-2">
                      <button type="button" onClick={() => setOpenQuote(openQuote === s.id ? null : s.id)} aria-expanded={openQuote === s.id} className="inline-flex items-center gap-1 text-xs font-medium" data-testid={`button-quote-${s.id}`}>
                        <Quote className="h-3 w-3" /> Quoted text <ChevronDown className={cn('h-3 w-3 transition-transform', openQuote === s.id && 'rotate-180')} />
                      </button>
                      {openQuote === s.id && <blockquote className="border-l-2 border-vermilion pl-3 text-sm italic text-ink/75">{s.quote || 'No quote supplied.'}</blockquote>}
                      <div><Source url={s.sourceUrl} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section id="gallery" kicker="03" title="Photo gallery">
          {images.length === 0 ? (
            <Empty kicker="Photos" title={project.demonstration ? "No authorized media attached yet." : "No permitted photos yet."}>Photos are shown only with confirmed reuse permission. Nothing is substituted.</Empty>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 [&>*]:mb-3">
              {images.map((m) => (
                <figure key={m.id} className="break-inside-avoid">
                  <button type="button" onClick={() => setLightbox(m)} className="block w-full overflow-hidden rounded-sm bg-ink/5" data-testid={`button-photo-${m.id}`} aria-label={`Open photo: ${m.caption || 'untitled'}`}>
                    <img src={m.url} alt={m.caption || 'Project photo'} loading="lazy" className="w-full hover:scale-[1.02] transition-transform duration-500" />
                  </button>
                  <figcaption className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/70">
                    <span>{m.caption}</span>
                    {preview && <span className="meta">{m.permissionStatus}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </Section>

        <Section id="video" kicker="04" title="Video">
          {videos.length === 0 ? (
            <Empty kicker="Video" title="No permitted video yet.">
              <span className="inline-flex items-center gap-2"><VideoOff className="h-4 w-4" />When a video has confirmed permission, it plays here with its source.</span>
            </Empty>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {videos.map((v) => {
                const em = embedUrl(v.url);
                return (
                  <figure key={v.id}>
                    <div className="aspect-video bg-ink rounded-sm overflow-hidden">
                      {em ? <iframe src={em} title={v.caption || 'Project video'} className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen />
                        : <video src={v.url} controls preload="metadata" className="h-full w-full" data-testid={`video-${v.id}`}>Your browser cannot play this video.</video>}
                    </div>
                    <figcaption className="mt-2 flex flex-wrap justify-between gap-2 text-sm"><span>{v.caption}</span><Source url={v.sourceUrl} /></figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </Section>

        <Section id="timeline" kicker="05" title="Dated timeline">
          {filteredUpdates.length === 0 ? (
            <Empty kicker="Timeline" title={since ? 'Nothing new since that date.' : 'No dated updates found.'}>Updates appear only with a date and a quoted source.</Empty>
          ) : (
            <ol className="relative border-l border-ink/20 ml-2">
              {filteredUpdates.map((u) => {
                const open = openUpdate === u.id;
                return (
                  <li key={u.id} className="relative pl-6 pb-6">
                    <span className={cn('absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full border border-ink', open ? 'bg-vermilion border-vermilion' : 'bg-paper')} aria-hidden />
                    <button type="button" onClick={() => setOpenUpdate(open ? null : u.id)} aria-expanded={open} className="text-left w-full group" data-testid={`button-update-${u.id}`}>
                      <span className="meta text-ink/55">{fmtDate(u.date)}</span>
                      <span className="mt-1 flex items-center gap-2 font-display text-lg font-semibold group-hover:text-vermilion-deep">{u.title}<ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} /></span>
                    </button>
                    {open && (
                      <div className="mt-3 space-y-3 max-w-2xl rise">
                        <p className="text-sm leading-relaxed whitespace-pre-line">{u.body}</p>
                        {u.quote && <blockquote className="border-l-2 border-vermilion pl-3 text-sm italic text-ink/75">{u.quote}</blockquote>}
                        <Source url={u.sourceUrl} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        <Section id="evidence" kicker="06" title="Evidence panel">
          {project.claims.length === 0 ? (
            <Empty kicker="Claims" title="No claims recorded.">A claim needs a quote and a source link before it can be shown.</Empty>
          ) : (
            <ul className="divide-y divide-ink/10 border-y border-ink/10">
              {project.claims.map((c) => (
                <li key={c.id} className="py-5 grid gap-3 md:grid-cols-[1fr_auto]" data-testid={`row-claim-${c.id}`}>
                  <div>
                    <p className="font-medium">{c.text}</p>
                    <blockquote className="mt-2 border-l-2 border-ink/25 pl-3 text-sm italic text-ink/70">{c.quote}</blockquote>
                    <div className="mt-2"><Source url={c.sourceUrl} /></div>
                    {c.reviews.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {c.reviews.map((r) => (
                          <div key={r.id} className="keep-dark raised rounded-sm bg-ink text-paper p-4 text-sm">
                            <p className="meta text-vermilion">Independent review, {fmtDate(r.createdAt)}</p>
                            <p className="mt-2">{r.findings}</p>
                            <p className="mt-2 text-paper/70"><span className="meta text-paper/50 mr-2">Limitations</span>{r.limitations}</p>
                            <div className="mt-2 flex flex-wrap gap-3">{r.evidenceUrls.map((u) => <Source key={u} url={u} className="text-paper" />)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="md:text-right"><ClaimLabelBadge label={c.label} /></div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-ink/60">Labels are defined on the <a href={`${import.meta.env.BASE_URL}methodology`} className="underline">methodology page</a>. nujli. does not apply automated verification labels.</p>
        </Section>
      </div>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl bg-ink text-paper border-paper/15 p-3">
          <DialogTitle className="sr-only">{lightbox?.caption || 'Photo'}</DialogTitle>
          <DialogDescription className="sr-only">Full size project photo</DialogDescription>
          {lightbox && (
            <>
              <img src={lightbox.url} alt={lightbox.caption || 'Project photo'} className="max-h-[75vh] w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              <div className="flex flex-wrap justify-between gap-2 p-2 text-sm"><span>{lightbox.caption}</span><Source url={lightbox.sourceUrl} className="text-paper" /></div>
            </>
          )}
          {!lightbox && <ImageOff className="h-5 w-5" />}
        </DialogContent>
      </Dialog>
    </article>
  );
}
