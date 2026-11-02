import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import {
  usePublishProject, useListOrganizationProjects, getListOrganizationProjectsQueryKey, getListPublicProjectsQueryKey,
  getGetPublicSummaryQueryKey, getGetOrganizationProjectQueryKey,
} from '@workspace/api-client-react';
import type { Account, Project } from '@workspace/api-client-react';
import { Page } from '@/components/shell';
import { AiBanner, EntitlementBanner, OrgGate } from '@/components/org-gate';
import { Journey } from '@/components/journey';
import { Block, Empty, ErrorState, Kicker, StatusPill } from '@/components/states';
import { useToast } from '@/hooks/use-toast';
import { errMsg, fmtDate, hostOf } from '@/lib/format';

export function evidenceLabel(p: Project): string {
  const labels = p.claims.map((c) => c.label);
  if (labels.includes('Independently Reviewed')) return 'Independently Reviewed';
  if (labels.includes('Corroborated')) return 'Corroborated';
  if (labels.length) return 'Organization Reported';
  return 'No evidence yet';
}

const sm = 'inline-flex items-center h-9 px-3 rounded-sm border border-ink/20 text-sm font-medium hover:bg-ink hover:text-paper transition-colors';

function Row({ p }: { p: Project }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const publish = usePublishProject({
    mutation: {
      onSuccess: (np) => {
        qc.setQueryData(getGetOrganizationProjectQueryKey(np.id), np);
        qc.invalidateQueries({ queryKey: getListOrganizationProjectsQueryKey() });
        qc.invalidateQueries({ queryKey: getListPublicProjectsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetPublicSummaryQueryKey() });
        toast({ title: np.status === 'published' ? 'Your impact is now visible.' : 'Publish request sent' });
      },
      onError: (e) => toast({ title: 'Publish failed', description: errMsg(e), variant: 'destructive' }),
    },
  });
  return (
    <li className="grid gap-3 py-5 md:grid-cols-[1fr_auto] md:items-center" data-testid={`row-org-project-${p.id}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-lg font-semibold break-words">{p.title || hostOf(p.sourceUrl)}</p>
          <StatusPill status={p.status} />
        </div>
        <p className="mt-1 meta text-ink/55">{evidenceLabel(p)} / Updated {fmtDate(p.updatedAt)}</p>
        <a href={p.sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-1 block font-mono text-xs text-ink/55 truncate underline-offset-2 hover:underline">{p.sourceUrl}</a>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={p.status === 'published' ? `/projects/${p.id}` : `/organization/projects/${p.id}`} className={sm} data-testid={`link-view-${p.id}`}>View</Link>
        <Link href={`/organization/projects/${p.id}?mode=changes`} className={sm} data-testid={`link-edit-${p.id}`}>Edit</Link>
        {p.status === 'approved' && (
          <button type="button" onClick={() => publish.mutate({ id: p.id })} disabled={publish.isPending} className="inline-flex items-center h-9 px-3 rounded-sm bg-vermilion text-white text-sm font-medium disabled:opacity-40" data-testid={`button-publish-${p.id}`}>
            {publish.isPending ? 'Publishing' : 'Publish'}
          </button>
        )}
      </div>
    </li>
  );
}

function Dashboard({ me }: { me: Account }) {
  const list = useListOrganizationProjects();
  const can = me.entitlement.active;
  const projects = list.data ?? [];
  const hasPublished = projects.some((p) => p.status === 'published');
  const stage = !can ? 'Pay' : projects.length === 0 ? 'Generate' : hasPublished ? 'Publish' : 'Review';
  return (
    <Page>
      <section className="mx-auto max-w-4xl px-5 py-10 md:py-12 space-y-8">
        <Journey current={stage} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <Kicker className="text-ink/55">{me.organizationName ?? 'Your organization'}</Kicker>
            <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">My Projects</h1>
          </div>
          {can ? (
            <Link href="/organization/new" className="inline-flex items-center gap-2 h-11 px-5 rounded-sm bg-ink text-paper font-medium hover:bg-vermilion hover:text-white transition-colors" data-testid="link-new-project"><Plus className="h-4 w-4" />New Impact Page</Link>
          ) : (
            <Link href="/billing" className="inline-flex items-center gap-2 h-11 px-5 rounded-sm bg-vermilion text-white font-medium" data-testid="link-activate">Activate membership <ArrowRight className="h-4 w-4" /></Link>
          )}
        </div>
        <EntitlementBanner me={me} />
        <AiBanner me={me} />
        {me.role === 'reviewer' && <p className="text-sm">You also have reviewer access. <Link href="/reviewer" className="underline">Open the review inbox</Link>.</p>}

        {list.isLoading && <div className="space-y-2">{[0, 1, 2].map((i) => <Block key={i} className="h-20" />)}</div>}
        {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
        {!list.isLoading && !list.isError && projects.length === 0 && (
          <Empty kicker="No Impact Pages yet" title="Start with one project link." action={can ? <Link href="/organization/new" className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4">Generate your first Impact Page <ArrowRight className="h-4 w-4" /></Link> : <Link href="/billing" className="text-sm font-medium underline underline-offset-4">Activate membership first</Link>}>
            Paste a page you already published. You will see a private preview before anything goes public.
          </Empty>
        )}
        {projects.length > 0 && <ul className="divide-y divide-ink/10 border-y border-ink/10">{projects.map((p) => <Row key={p.id} p={p} />)}</ul>}
      </section>
    </Page>
  );
}

export default function OrganizationPage() {
  return <OrgGate>{(me) => <Dashboard me={me} />}</OrgGate>;
}
