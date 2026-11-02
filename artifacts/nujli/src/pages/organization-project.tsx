import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Copy, Eye, Globe2, Loader2, Pencil, RefreshCw, Save, Trash2, Undo2, X } from 'lucide-react';
import {
  useApproveProject, useDeleteProject, useGenerateProject, useGetGenerationJob, useGetOrganizationProject, usePublishProject,
  useSaveProject, useUnpublishProject, getGetGenerationJobQueryKey, getGetOrganizationProjectQueryKey, getListOrganizationProjectsQueryKey,
  getListPublicProjectsQueryKey, getGetPublicSummaryQueryKey,
} from '@workspace/api-client-react';
import type { Account, Claim, Media, Project, ProjectRevision, ProjectUpdate, Statistic } from '@workspace/api-client-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Page } from '@/components/shell';
import { AiBanner, EntitlementBanner, OrgGate } from '@/components/org-gate';
import { ProjectView } from '@/components/project-view';
import { ImmersionEditor, immersionProblems, pruneImmersion, revokeClaim, revokeMedia } from '@/components/immersion-editor';
import { ACTIVE_GEN, GEN_STEPS, Journey, genLabel } from '@/components/journey';
import { ClaimLabelBadge, Empty, ErrorState, Kicker, PageSkeleton, StatusPill } from '@/components/states';
import { useToast } from '@/hooks/use-toast';
import { errMsg, errStatus, fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function toRevision(p: Project): ProjectRevision {
  return {
    title: p.title, overview: p.overview, cause: p.cause, locationName: p.locationName, latitude: p.latitude, longitude: p.longitude,
    statistics: p.statistics.map((s) => ({ ...s })), updates: p.updates.map((u) => ({ ...u })),
    media: p.media.map((m) => ({ ...m })), claims: p.claims.map((c) => ({ ...c, reviews: [...c.reviews] })),
    immersion: p.immersion ? {
      scenes: p.immersion.scenes.map((s) => ({ ...s, hotspots: s.hotspots.map((h) => ({ ...h })) })),
      comparisons: p.immersion.comparisons.map((c) => ({ ...c })),
    } : undefined,
  };
}

function problems(r: ProjectRevision): string[] {
  const out: string[] = [];
  if (!r.title.trim()) out.push('Title is required.');
  r.statistics.forEach((s, i) => {
    if (!s.sourceUrl.trim() || !s.quote.trim()) out.push(`Statistic ${i + 1} needs a source URL and quote.`);
    if (!s.label.trim() || !s.value.trim()) out.push(`Statistic ${i + 1} needs a label and value.`);
  });
  r.updates.forEach((u, i) => { if (!u.sourceUrl.trim() || !u.quote.trim() || !u.date) out.push(`Update ${i + 1} needs a date, source URL and quote.`); });
  r.claims.forEach((c, i) => { if (!c.text.trim() || !c.sourceUrl.trim() || !c.quote.trim()) out.push(`Claim ${i + 1} needs text, a source URL and a quote.`); });
  r.media.forEach((m, i) => { if (!m.url.trim() || !m.sourceUrl.trim()) out.push(`Media ${i + 1} needs a file URL and a source URL.`); });
  if ((r.latitude === null) !== (r.longitude === null)) out.push('Provide both latitude and longitude, or neither.');
  out.push(...immersionProblems(r));
  return out;
}

const inputCls = 'w-full min-w-0 rounded-sm border border-input bg-card px-3 py-2 text-sm focus:border-ink';
function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn('block min-w-0', className)}><span className="meta text-ink/60">{label}</span><div className="mt-1">{children}</div></label>;
}

/** Correction/removal list. Items are created by AI generation only; no manual add. */
function ArraySection({ title, count, max, children }: { title: string; count: number; max: number; children: ReactNode; testid: string }) {
  return (
    <section className="border-t border-ink/10 pt-8">
      <h3 className="font-display text-xl font-semibold">{title} <span className="meta text-ink/50 ml-1">{count}/{max}</span></h3>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function ItemCard({ children, onRemove, label }: { children: ReactNode; onRemove: () => void; label: string }) {
  return (
    <div className="relative rounded-md border border-ink/15 bg-card p-4 pr-12">
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-sm text-ink/60 hover:bg-vermilion hover:text-white" data-testid={`button-remove-${label.replace(/\s+/g, '-').toLowerCase()}`}><Trash2 className="h-4 w-4" /></button>
      {children}
    </div>
  );
}

/** Full-width generation progress driven only by server status. */
function GenerationProgress({ status, message, onRetry, retrying, blocked, notStarted }: { status?: string; message?: string; onRetry: () => void; retrying: boolean; blocked: boolean; notStarted: boolean }) {
  const idx = GEN_STEPS.findIndex((s) => s.key === status);
  const failed = status === 'failed';
  return (
    <div className="keep-dark raised rounded-md bg-ink text-paper p-6 md:p-10" data-testid="panel-generation" aria-live="polite">
      <p className="meta text-paper/55">{failed ? 'Generation stopped' : notStarted ? 'Not started' : 'Working on your page'}</p>
      <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3" data-testid="text-job-status">
        {!failed && !notStarted && <Loader2 className="h-7 w-7 shrink-0 animate-spin text-vermilion" aria-hidden />}
        {notStarted ? 'Generation has not started yet.' : genLabel(status)}
      </h2>
      {message && <p className="mt-3 text-paper/70 max-w-xl" data-testid="text-job-message">{message}</p>}
      {!notStarted && !failed && (
        <ol className="mt-8 space-y-3" aria-label="Generation progress">
          {GEN_STEPS.map((s, i) => {
            const done = i < idx; const now = i === idx;
            return (
              <li key={s.key} className={cn('flex items-center gap-3 text-sm md:text-base', done ? 'text-paper/80' : now ? 'text-paper font-medium' : 'text-paper/35')}>
                <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full border', done ? 'bg-paper text-ink border-paper' : now ? 'border-vermilion' : 'border-paper/20')}>
                  {done ? <Check className="h-3.5 w-3.5" /> : now ? <span className="h-2 w-2 rounded-full bg-vermilion animate-pulse" /> : null}
                </span>
                {s.label}
              </li>
            );
          })}
        </ol>
      )}
      {(failed || notStarted) && (
        <button type="button" onClick={onRetry} disabled={retrying || blocked} className="mt-8 inline-flex items-center gap-2 h-11 px-5 rounded-sm bg-vermilion text-white font-medium disabled:opacity-40" title={blocked ? 'Requires active membership and configured AI' : undefined} data-testid="button-retry-generate">
          <RefreshCw className={cn('h-4 w-4', retrying && 'animate-spin')} />{retrying ? 'Starting' : 'Try again'}
        </button>
      )}
      {!failed && !notStarted && <p className="mt-8 text-xs text-paper/50">You can leave this page. Progress continues on our side and resumes here when you return.</p>}
    </div>
  );
}

function PublishedSuccess({ id, onBack }: { id: string; onBack: () => void }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const shareUrl = `${window.location.origin}${basePath}/projects/${id}`;
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };
  return (
    <Page dark>
      <section className="geo-bg min-h-[calc(100dvh-4rem)] flex items-center">
        <div className="mx-auto w-full max-w-3xl px-5 py-16">
          <Journey current="Publish" dark />
          <h1 className="mt-12 font-display font-bold tracking-tight leading-[1.02] text-[clamp(36px,7vw,72px)] rise" data-testid="text-published-headline">Your impact is now <span className="hz">visible.</span></h1>
          <p className="mt-5 text-lg text-paper/75 rise" style={{ animationDelay: '80ms' }}>Your Impact Page is live and ready to share with supporters.</p>
          <div className="mt-10 flex flex-col sm:flex-row flex-wrap gap-3 rise" style={{ animationDelay: '140ms' }}>
            <Link href={`/projects/${id}`} className="btn-outline justify-center px-6 py-3" data-testid="link-view-impact-page"><Eye className="h-4 w-4" />View My Impact Page</Link>
            <button type="button" onClick={copy} className="btn-outline justify-center px-6 py-3" data-testid="button-copy-share-link"><Copy className="h-4 w-4" />{copyState === 'copied' ? 'Link copied' : 'Copy Share Link'}</button>
            <Link href="/organization" onClick={onBack} className="inline-flex items-center justify-center px-6 py-3 text-sm text-paper/75 underline underline-offset-4 hover:text-paper" data-testid="link-return-projects">Return to My Projects</Link>
          </div>
          {copyState === 'failed' && (
            <div className="mt-6 rounded-md border border-vermilion/50 p-4" role="alert">
              <p className="text-sm">Your browser blocked copying. Select the link below and copy it manually.</p>
              <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} className="mt-3 h-11 w-full rounded-sm border border-paper/20 bg-ink px-3 font-mono text-xs text-paper" data-testid="input-share-link" />
            </div>
          )}
        </div>
      </section>
    </Page>
  );
}

function Editor({ me, id }: { me: Account; id: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const pq = useGetOrganizationProject(id, { query: { queryKey: getGetOrganizationProjectQueryKey(id), enabled: !!id, retry: (n, e) => errStatus(e) !== 404 && n < 2 } });
  const project = pq.data;
  const job = useGetGenerationJob(id, {
    query: {
      queryKey: getGetGenerationJobQueryKey(id),
      enabled: !!id,
      retry: (n, e) => errStatus(e) !== 404 && n < 2,
      refetchInterval: (q) => (q.state.data && ACTIVE_GEN.includes(q.state.data.status as string) ? 2000 : false),
    },
  });
  const jobStatus = job.data?.status as string | undefined;
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevStatus.current && ACTIVE_GEN.includes(prevStatus.current) && jobStatus === 'completed') {
      qc.invalidateQueries({ queryKey: getGetOrganizationProjectQueryKey(id) });
      qc.invalidateQueries({ queryKey: getListOrganizationProjectsQueryKey() });
    }
    prevStatus.current = jobStatus;
  }, [jobStatus, id, qc]);

  const [rev, setRev] = useState<ProjectRevision | null>(null);
  const [dirty, setDirty] = useState(false);
  const initKey = useRef('');
  const [mode, setMode] = useState<'preview' | 'changes'>(() => (new URLSearchParams(search).get('mode') === 'changes' ? 'changes' : 'preview'));
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [checks, setChecks] = useState({ accuracyConfirmed: false, permissionsConfirmed: false, privacyConfirmed: false });

  useEffect(() => {
    if (!project) return;
    const key = `${project.id}:${project.updatedAt}`;
    if (initKey.current !== key && !dirty) { initKey.current = key; setRev(toRevision(project)); }
  }, [project, dirty]);

  const after = (p: Project) => {
    qc.setQueryData(getGetOrganizationProjectQueryKey(id), p);
    qc.invalidateQueries({ queryKey: getListOrganizationProjectsQueryKey() });
    qc.invalidateQueries({ queryKey: getListPublicProjectsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetPublicSummaryQueryKey() });
  };
  const onErr = (title: string) => (e: unknown) => toast({ title, description: errMsg(e), variant: 'destructive' });
  const gen = useGenerateProject({ mutation: { onSuccess: (j) => qc.setQueryData(getGetGenerationJobQueryKey(id), j), onError: onErr('Generation did not start') } });
  const save = useSaveProject({ mutation: { onSuccess: (p) => { setDirty(false); initKey.current = `${p.id}:${p.updatedAt}`; setRev(toRevision(p)); after(p); setMode('preview'); toast({ title: 'Changes saved', description: p.status === 'draft' ? 'Review the preview, then choose Looks Good.' : undefined }); }, onError: onErr('Save failed') } });
  const approve = useApproveProject({ mutation: { onSuccess: (p) => { after(p); setApproveOpen(false); toast({ title: p.status === 'approved' ? 'Approved' : 'Approval sent', description: p.status === 'approved' ? 'You can publish now.' : undefined }); }, onError: onErr('Approval failed') } });
  const publish = usePublishProject({ mutation: { onSuccess: (p) => { after(p); if (p.status === 'published') setJustPublished(true); else toast({ title: 'Not published', description: `The server returned status "${p.status}".`, variant: 'destructive' }); }, onError: onErr('Publish failed') } });
  const unpublish = useUnpublishProject({ mutation: { onSuccess: (p) => { after(p); toast({ title: 'Unpublished' }); }, onError: onErr('Unpublish failed') } });
  const del = useDeleteProject({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListOrganizationProjectsQueryKey() }); qc.invalidateQueries({ queryKey: getListPublicProjectsQueryKey() }); qc.removeQueries({ queryKey: getGetOrganizationProjectQueryKey(id) }); setLocation('/organization'); }, onError: onErr('Delete failed') } });

  if (pq.isLoading) return <Page><PageSkeleton /></Page>;
  if (pq.isError || !project) return (
    <Page><div className="mx-auto max-w-2xl px-5 py-16">
      {errStatus(pq.error) === 404 ? <Empty kicker="Not found" title="This project is not available." action={<Link href="/organization" className="underline">Back to My Projects</Link>}>It may have been deleted.</Empty> : <ErrorState error={pq.error} onRetry={() => pq.refetch()} />}
    </div></Page>
  );
  if (justPublished && project.status === 'published') return <PublishedSuccess id={id} onBack={() => setJustPublished(false)} />;

  const blocked = !me.entitlement.active || !me.aiConfigured;
  const jobMissing = job.isError && errStatus(job.error) === 404;
  const generating = !!jobStatus && ACTIVE_GEN.includes(jobStatus);
  const showProgress = job.isLoading || generating || jobStatus === 'failed' || ((jobMissing || jobStatus === 'idle') && project.status === 'draft' && !project.title && project.claims.length === 0);
  const r = rev ?? toRevision(project);
  const set = (patch: Partial<ProjectRevision>) => { setRev({ ...r, ...patch }); setDirty(true); };
  const upd = <T extends { id: string }>(key: 'statistics' | 'updates' | 'media' | 'claims', itemId: string, patch: Partial<T>) =>
    set({
      [key]: (r[key] as unknown as T[]).map((x) => (x.id === itemId ? { ...x, ...patch } : x)),
      ...(key === 'media' ? { immersion: revokeMedia(r.immersion, itemId) } : key === 'claims' ? { immersion: revokeClaim(r.immersion, itemId) } : {}),
    } as Partial<ProjectRevision>);
  const rm = (key: 'statistics' | 'updates' | 'media' | 'claims', itemId: string) => {
    const media = key === 'media' ? r.media.filter((x) => x.id !== itemId) : r.media;
    const claims = key === 'claims' ? r.claims.filter((x) => x.id !== itemId) : r.claims;
    set({ [key]: (r[key] as { id: string }[]).filter((x) => x.id !== itemId), immersion: pruneImmersion(r.immersion, new Set(media.map((m) => m.id)), new Set(claims.map((c) => c.id))) } as Partial<ProjectRevision>);
  };
  const issues = problems(r);
  const doSave = () => save.mutate({ id, data: r });
  const previewProject: Project = { ...project, ...r };
  const allChecked = checks.accuracyConfirmed && checks.permissionsConfirmed && checks.privacyConfirmed;
  const pendingMedia = r.media.filter((m) => m.permissionStatus === 'pending').length;
  const numOrNull = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));
  const stage = showProgress ? 'Generate' : project.status === 'draft' ? 'Review' : 'Publish';

  return (
    <Page>
      <section className="mx-auto max-w-6xl px-5 pt-8 pb-4 space-y-6">
        <Link href="/organization" className="inline-flex items-center gap-1.5 text-sm text-ink/70 hover:text-ink"><ArrowLeft className="h-4 w-4" />My Projects</Link>
        <Journey current={stage} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3"><Kicker className="text-ink/55">{showProgress ? 'Generating' : 'Private preview'}</Kicker><StatusPill status={project.status} /></div>
            <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold tracking-tight break-words">{project.title || 'Your Impact Page'}</h1>
            <p className="mt-1 font-mono text-xs text-ink/55 break-all">{project.sourceUrl}</p>
            <p className="meta mt-2 text-ink/50">Updated {fmtDate(project.updatedAt)}{project.approvedAt ? ` / Approved ${fmtDate(project.approvedAt)}` : ''}{project.publishedAt ? ` / Published ${fmtDate(project.publishedAt)}` : ''}</p>
          </div>
          {!showProgress && (
            <div className="flex flex-wrap gap-2">
              {project.status === 'published' && (
                <>
                  <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-sm border border-ink/25 text-sm font-medium" data-testid="link-view-public"><Eye className="h-4 w-4" />View My Impact Page</Link>
                  <button type="button" onClick={() => unpublish.mutate({ id })} disabled={unpublish.isPending} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-sm border border-ink/25 text-sm font-medium" data-testid="button-unpublish"><Undo2 className="h-4 w-4" />{unpublish.isPending ? 'Unpublishing' : 'Unpublish'}</button>
                </>
              )}
              <button type="button" onClick={() => gen.mutate({ id })} disabled={gen.isPending || blocked} title={blocked ? 'Requires active membership and configured AI' : 'Rebuild from your sources. Replaces the draft.'} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-sm text-sm text-ink/70 hover:bg-ink/5 disabled:opacity-40" data-testid="button-regenerate"><RefreshCw className={cn('h-4 w-4', gen.isPending && 'animate-spin')} />Regenerate</button>
              <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-sm text-sm text-vermilion-deep hover:bg-vermilion/10" data-testid="button-delete"><Trash2 className="h-4 w-4" />Delete</button>
            </div>
          )}
        </div>
        <EntitlementBanner me={me} />
        <AiBanner me={me} />
      </section>

      {showProgress ? (
        <section className="mx-auto max-w-3xl px-5 pb-20">
          {job.isLoading ? (
            <div className="keep-dark raised rounded-md bg-ink text-paper p-8 flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-vermilion" />Checking progress</div>
          ) : job.isError && !jobMissing ? (
            <ErrorState error={job.error} title="We could not check generation progress." onRetry={() => job.refetch()} />
          ) : (
            <GenerationProgress status={jobStatus} message={job.data?.message} onRetry={() => gen.mutate({ id })} retrying={gen.isPending} blocked={blocked} notStarted={jobMissing || jobStatus === 'idle'} />
          )}
        </section>
      ) : (
        <>
          {project.status !== 'published' && (
            <section className="mx-auto max-w-6xl px-5 pb-6">
              <div className="rounded-md border border-ink/15 bg-card p-5 flex flex-col md:flex-row md:items-center gap-4">
                <p className="flex-1 text-sm md:text-base">
                  {project.status === 'draft'
                    ? 'This is a private preview. Nothing is public yet. Does it represent your work accurately?'
                    : 'Approved. When you are ready, publish it to the public map.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {project.status === 'draft' && (
                    <>
                      <button type="button" onClick={() => setApproveOpen(true)} disabled={dirty || approve.isPending} title={dirty ? 'Save changes first' : undefined} className="inline-flex items-center gap-1.5 h-11 px-5 rounded-sm bg-ink text-paper font-medium disabled:opacity-40" data-testid="button-looks-good"><Check className="h-4 w-4" />Looks Good</button>
                      <button type="button" onClick={() => setMode(mode === 'changes' ? 'preview' : 'changes')} className="inline-flex items-center gap-1.5 h-11 px-5 rounded-sm border border-ink/25 font-medium" data-testid="button-make-changes">{mode === 'changes' ? <><Eye className="h-4 w-4" />Back to preview</> : <><Pencil className="h-4 w-4" />Make Changes</>}</button>
                    </>
                  )}
                  {project.status === 'approved' && (
                    <>
                      <button type="button" onClick={() => publish.mutate({ id })} disabled={dirty || publish.isPending} className="inline-flex items-center gap-1.5 h-11 px-5 rounded-sm bg-vermilion text-white font-medium disabled:opacity-40" data-testid="button-publish"><Globe2 className="h-4 w-4" />{publish.isPending ? 'Publishing' : 'Publish My Impact Page'}</button>
                      <button type="button" onClick={() => setMode(mode === 'changes' ? 'preview' : 'changes')} className="inline-flex items-center gap-1.5 h-11 px-5 rounded-sm border border-ink/25 font-medium" data-testid="button-make-changes">{mode === 'changes' ? 'Back to preview' : 'Make Changes'}</button>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}
          {project.status === 'published' && (
            <section className="mx-auto max-w-6xl px-5 pb-6">
              <button type="button" onClick={() => setMode(mode === 'changes' ? 'preview' : 'changes')} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-sm border border-ink/25 text-sm font-medium" data-testid="button-make-changes">{mode === 'changes' ? <><Eye className="h-4 w-4" />Back to preview</> : <><Pencil className="h-4 w-4" />Make Changes</>}</button>
            </section>
          )}

          {mode === 'preview' ? (
            <div className="border-t border-ink/10 overflow-x-hidden">
              <p className="mx-auto max-w-6xl px-5 py-3 meta text-ink/55">Exactly what donors will see. Media pending permission is visible only to you.{dirty ? ' Showing unsaved changes.' : ''}</p>
              {project.warnings.length > 0 && <ul className="mx-auto max-w-6xl px-5 pb-3 text-sm text-ink/70 list-disc pl-10">{project.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
              <ProjectView project={previewProject} preview />
            </div>
          ) : (
            <>
              <div className="mx-auto max-w-6xl px-5">
                <p className="text-sm border-l-2 border-vermilion pl-3" role="note">Correct wording, fix a source, set media permission, or remove anything that should not appear. New items come only from your sources; use Regenerate to rebuild.{project.status !== 'draft' ? ` Saving resets approval${project.status === 'published' ? ' and unpublishes this page' : ''}.` : ''}</p>
              </div>
        <form className="mx-auto max-w-6xl px-5 pt-6 pb-36 space-y-8" onSubmit={(e) => e.preventDefault()}>
          <section className="grid gap-4 md:grid-cols-2">
            <Field label="Title" className="md:col-span-2"><input className={inputCls} value={r.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} data-testid="input-title" /></Field>
            <Field label="Overview" className="md:col-span-2"><textarea className={cn(inputCls, 'min-h-[140px]')} value={r.overview} maxLength={10000} onChange={(e) => set({ overview: e.target.value })} data-testid="input-overview" /></Field>
            <Field label="Cause"><input className={inputCls} value={r.cause} maxLength={100} onChange={(e) => set({ cause: e.target.value })} data-testid="input-cause" /></Field>
            <Field label="Location name"><input className={inputCls} value={r.locationName} maxLength={200} onChange={(e) => set({ locationName: e.target.value })} data-testid="input-location" /></Field>
            <Field label="Latitude (-90 to 90)"><input className={cn(inputCls, 'font-mono')} type="number" step="any" min={-90} max={90} value={r.latitude ?? ''} onChange={(e) => set({ latitude: numOrNull(e.target.value) })} data-testid="input-latitude" /></Field>
            <Field label="Longitude (-180 to 180)"><input className={cn(inputCls, 'font-mono')} type="number" step="any" min={-180} max={180} value={r.longitude ?? ''} onChange={(e) => set({ longitude: numOrNull(e.target.value) })} data-testid="input-longitude" /></Field>
          </section>

          <ArraySection title="Claims" count={r.claims.length} max={100} testid="claim">
            {r.claims.length === 0 && <p className="text-sm text-ink/60">No claims were found in your sources.</p>}
            {r.claims.map((c, i) => (
              <ItemCard key={c.id} onRemove={() => rm('claims', c.id)} label={`claim ${i + 1}`}>
                <div className="flex items-center gap-2 mb-3"><span className="meta text-ink/50">Claim {i + 1}</span><ClaimLabelBadge label={c.label} /></div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Claim text" className="md:col-span-2"><textarea className={inputCls} value={c.text} maxLength={2000} onChange={(e) => upd<Claim>('claims', c.id, { text: e.target.value })} /></Field>
                  <Field label="Source URL"><input className={cn(inputCls, 'font-mono')} type="url" value={c.sourceUrl} onChange={(e) => upd<Claim>('claims', c.id, { sourceUrl: e.target.value })} /></Field>
                  <Field label="Verbatim quote"><textarea className={inputCls} value={c.quote} maxLength={4000} onChange={(e) => upd<Claim>('claims', c.id, { quote: e.target.value })} /></Field>
                </div>
                <p className="mt-2 text-xs text-ink/55">Labels are set by evidence and review, not by editing.</p>
              </ItemCard>
            ))}
          </ArraySection>

          <ArraySection title="Statistics" count={r.statistics.length} max={40} testid="statistic">
            {r.statistics.length === 0 && <p className="text-sm text-ink/60">No statistics.</p>}
            {r.statistics.map((s, i) => (
              <ItemCard key={s.id} onRemove={() => rm('statistics', s.id)} label={`statistic ${i + 1}`}>
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Label" className="md:col-span-2"><input className={inputCls} value={s.label} onChange={(e) => upd<Statistic>('statistics', s.id, { label: e.target.value })} /></Field>
                  <Field label="Value"><input className={cn(inputCls, 'font-mono')} value={s.value} onChange={(e) => upd<Statistic>('statistics', s.id, { value: e.target.value })} /></Field>
                  <Field label="Unit"><input className={inputCls} value={s.unit} onChange={(e) => upd<Statistic>('statistics', s.id, { unit: e.target.value })} /></Field>
                  <Field label="As of (blank = undated)"><input type="date" className={cn(inputCls, 'font-mono')} value={s.asOf ? s.asOf.slice(0, 10) : ''} onChange={(e) => upd<Statistic>('statistics', s.id, { asOf: e.target.value || null })} /></Field>
                  <Field label="Linked claim">
                    <select className={inputCls} value={s.claimId} onChange={(e) => upd<Statistic>('statistics', s.id, { claimId: e.target.value })}>
                      <option value="">None</option>
                      {r.claims.map((c, ci) => <option key={c.id} value={c.id}>Claim {ci + 1}: {c.text.slice(0, 40)}</option>)}
                    </select>
                  </Field>
                  <Field label="Source URL" className="md:col-span-2"><input type="url" className={cn(inputCls, 'font-mono')} value={s.sourceUrl} onChange={(e) => upd<Statistic>('statistics', s.id, { sourceUrl: e.target.value })} /></Field>
                  <Field label="Verbatim quote" className="md:col-span-4"><textarea className={inputCls} value={s.quote} onChange={(e) => upd<Statistic>('statistics', s.id, { quote: e.target.value })} /></Field>
                </div>
              </ItemCard>
            ))}
          </ArraySection>

          <ArraySection title="Dated updates" count={r.updates.length} max={100} testid="update">
            {r.updates.length === 0 && <p className="text-sm text-ink/60">No updates.</p>}
            {r.updates.map((u, i) => (
              <ItemCard key={u.id} onRemove={() => rm('updates', u.id)} label={`update ${i + 1}`}>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Title" className="md:col-span-2"><input className={inputCls} value={u.title} onChange={(e) => upd<ProjectUpdate>('updates', u.id, { title: e.target.value })} /></Field>
                  <Field label="Date"><input type="date" className={cn(inputCls, 'font-mono')} value={u.date ? u.date.slice(0, 10) : ''} onChange={(e) => upd<ProjectUpdate>('updates', u.id, { date: e.target.value })} /></Field>
                  <Field label="Body" className="md:col-span-3"><textarea className={inputCls} value={u.body} onChange={(e) => upd<ProjectUpdate>('updates', u.id, { body: e.target.value })} /></Field>
                  <Field label="Source URL"><input type="url" className={cn(inputCls, 'font-mono')} value={u.sourceUrl} onChange={(e) => upd<ProjectUpdate>('updates', u.id, { sourceUrl: e.target.value })} /></Field>
                  <Field label="Verbatim quote" className="md:col-span-2"><textarea className={inputCls} value={u.quote} onChange={(e) => upd<ProjectUpdate>('updates', u.id, { quote: e.target.value })} /></Field>
                </div>
              </ItemCard>
            ))}
          </ArraySection>

          <ArraySection title="Media" count={r.media.length} max={50} testid="media">
            {pendingMedia > 0 && <p className="text-sm border-l-2 border-vermilion pl-3">{pendingMedia} item(s) await your permission decision. Pending and rejected media never appear publicly.</p>}
            {r.media.length === 0 && <p className="text-sm text-ink/60">No media.</p>}
            {r.media.map((m, i) => (
              <ItemCard key={m.id} onRemove={() => rm('media', m.id)} label={`media ${i + 1}`}>
                <div className="grid gap-4 md:grid-cols-[140px_1fr]">
                  <div className="aspect-square rounded-sm bg-ink/5 overflow-hidden grid place-items-center">
                    {m.type === 'image' && m.url ? <img src={m.url} alt={m.caption || 'Media preview'} className="h-full w-full object-cover" /> : <span className="meta text-ink/50">{m.type}</span>}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="File URL"><input type="url" className={cn(inputCls, 'font-mono')} value={m.url} onChange={(e) => upd<Media>('media', m.id, { url: e.target.value })} /></Field>
                    <Field label="Type">
                      <select className={inputCls} value={m.type} onChange={(e) => upd<Media>('media', m.id, { type: e.target.value as Media['type'] })}><option value="image">Image</option><option value="video">Video</option></select>
                    </Field>
                    <Field label="Caption"><input className={inputCls} value={m.caption} onChange={(e) => upd<Media>('media', m.id, { caption: e.target.value })} /></Field>
                    <Field label="Source URL"><input type="url" className={cn(inputCls, 'font-mono')} value={m.sourceUrl} onChange={(e) => upd<Media>('media', m.id, { sourceUrl: e.target.value })} /></Field>
                    <fieldset className="md:col-span-2">
                      <legend className="meta text-ink/60">Permission for this item</legend>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {(['approved', 'pending', 'rejected'] as const).map((ps) => (
                          <button key={ps} type="button" aria-pressed={m.permissionStatus === ps} onClick={() => upd<Media>('media', m.id, { permissionStatus: ps })} className={cn('px-3 h-8 rounded-sm text-xs font-medium border', m.permissionStatus === ps ? (ps === 'approved' ? 'bg-ink text-paper border-ink' : ps === 'rejected' ? 'bg-vermilion text-white border-vermilion' : 'bg-paper-3 border-ink/30') : 'border-ink/20 text-ink/70')} data-testid={`button-permission-${ps}-${m.id}`}>
                            {ps === 'approved' ? 'Permission confirmed' : ps === 'pending' ? 'Pending' : 'Rejected'}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                </div>
              </ItemCard>
            ))}
          </ArraySection>

          <ImmersionEditor r={r} set={set} />
        </form>
            </>
          )}
        </>
      )}

      {mode === 'changes' && !showProgress && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-ink/15 bg-paper/95 backdrop-blur">
          <div className="mx-auto max-w-6xl px-5 py-3 flex flex-wrap items-center gap-3">
            <p className="text-sm flex-1 min-w-0 basis-full sm:basis-auto" aria-live="polite">
              {issues.length > 0 ? <span className="text-vermilion-deep">{issues[0]}{issues.length > 1 ? ` (+${issues.length - 1} more)` : ''}</span> : dirty ? 'Unsaved changes' : 'No changes yet'}
            </p>
            {dirty && <button type="button" onClick={() => { setDirty(false); setRev(toRevision(project)); }} className="h-10 px-4 text-sm inline-flex items-center gap-1.5" data-testid="button-discard"><X className="h-4 w-4" />Discard</button>}
            <button type="button" disabled={!dirty || issues.length > 0 || save.isPending} onClick={() => (project.status === 'draft' ? doSave() : setConfirmSave(true))} className="h-10 px-5 rounded-sm bg-ink text-paper text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-40" data-testid="button-save">
              <Save className="h-4 w-4" />{save.isPending ? 'Saving' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmSave} onOpenChange={setConfirmSave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Saving withdraws approval</AlertDialogTitle>
            <AlertDialogDescription>This page is {project.status}. Saving resets it to draft{project.status === 'published' ? ' and removes it from the public map' : ''} until you approve and publish again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={doSave} data-testid="button-confirm-save">Save and reset approval</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this Impact Page?</AlertDialogTitle>
            <AlertDialogDescription>The draft, its evidence and any public page will be removed. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate({ id })} className="bg-vermilion text-white" data-testid="button-confirm-delete">Delete permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Confirm before publishing</AlertDialogTitle>
            <AlertDialogDescription>All three confirmations are required. You will publish in the next step.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            {([
              ['accuracyConfirmed', 'The content accurately reflects the linked sources.'],
              ['permissionsConfirmed', 'We have permission to show every media item marked confirmed.'],
              ['privacyConfirmed', 'No beneficiary or private personal data is shown.'],
            ] as const).map(([k, t]) => (
              <label key={k} className="flex items-start gap-3 text-sm cursor-pointer">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#D42A2F]" checked={checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} data-testid={`checkbox-${k}`} />
                <span>{t}</span>
              </label>
            ))}
            {pendingMedia > 0 && <p className="text-xs text-ink/60">{pendingMedia} media item(s) are still pending and will stay hidden.</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!allChecked || approve.isPending} onClick={(e) => { e.preventDefault(); approve.mutate({ id, data: checks }); }} data-testid="button-confirm-approve">{approve.isPending ? 'Approving' : 'Approve'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

export default function OrganizationProject() {
  const { id = '' } = useParams<{ id: string }>();
  return <OrgGate>{(me) => <Editor me={me} id={id} />}</OrgGate>;
}
