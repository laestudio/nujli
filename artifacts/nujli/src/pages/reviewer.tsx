import { useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Plus, ShieldOff, Trash2 } from 'lucide-react';
import { useListReviewerClaims, useSubmitIndependentReview, getListReviewerClaimsQueryKey } from '@workspace/api-client-react';
import type { ReviewClaim } from '@workspace/api-client-react';
import { Page } from '@/components/shell';
import { OrgGate } from '@/components/org-gate';
import { Block, ClaimLabelBadge, Empty, ErrorState, Kicker } from '@/components/states';
import { useToast } from '@/hooks/use-toast';
import { errMsg, hostOf } from '@/lib/format';

const inputCls = 'w-full rounded-sm border border-input bg-card px-3 py-2 text-sm';

function ReviewForm({ claim, onDone }: { claim: ReviewClaim; onDone: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [findings, setFindings] = useState('');
  const [limitations, setLimitations] = useState('');
  const [urls, setUrls] = useState<string[]>(['']);
  const [coi, setCoi] = useState(false);
  const submit = useSubmitIndependentReview({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListReviewerClaimsQueryKey() }); toast({ title: 'Review recorded' }); onDone(); },
      onError: (e) => toast({ title: 'Review rejected', description: errMsg(e), variant: 'destructive' }),
    },
  });
  const clean = urls.map((u) => u.trim()).filter(Boolean);
  const valid = findings.trim().length >= 20 && limitations.trim().length >= 10 && clean.length >= 1 && clean.every((u) => /^https?:\/\//.test(u)) && coi;
  return (
    <form className="mt-4 space-y-3 border-t border-ink/10 pt-4" onSubmit={(e) => { e.preventDefault(); if (valid) submit.mutate({ id: claim.id, data: { findings: findings.trim(), limitations: limitations.trim(), evidenceUrls: clean, conflictOfInterestConfirmed: coi } }); }}>
      <label className="block"><span className="meta text-ink/60">Findings (min 20 characters)</span><textarea className={inputCls + ' mt-1 min-h-[90px]'} value={findings} maxLength={5000} onChange={(e) => setFindings(e.target.value)} data-testid={`input-findings-${claim.id}`} /></label>
      <label className="block"><span className="meta text-ink/60">Limitations (min 10 characters)</span><textarea className={inputCls + ' mt-1'} value={limitations} maxLength={5000} onChange={(e) => setLimitations(e.target.value)} data-testid={`input-limitations-${claim.id}`} /></label>
      <fieldset>
        <legend className="meta text-ink/60">Evidence URLs</legend>
        <div className="mt-1 space-y-2">
          {urls.map((u, i) => (
            <div key={i} className="flex gap-2">
              <input type="url" className={inputCls + ' font-mono'} value={u} onChange={(e) => setUrls(urls.map((x, j) => (j === i ? e.target.value : x)))} placeholder="https://" aria-label={`Evidence URL ${i + 1}`} />
              {urls.length > 1 && <button type="button" onClick={() => setUrls(urls.filter((_, j) => j !== i))} aria-label="Remove URL" className="px-2"><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
          {urls.length < 20 && <button type="button" onClick={() => setUrls([...urls, ''])} className="inline-flex items-center gap-1 text-xs font-medium"><Plus className="h-3 w-3" />Add URL</button>}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 accent-[#D42A2F]" checked={coi} onChange={(e) => setCoi(e.target.checked)} data-testid={`checkbox-coi-${claim.id}`} />I have no conflict of interest with this organization or project.</label>
      <div className="flex gap-2">
        <button type="submit" disabled={!valid || submit.isPending} className="h-10 px-4 rounded-sm bg-ink text-paper text-sm font-medium disabled:opacity-40" data-testid={`button-submit-review-${claim.id}`}>{submit.isPending ? 'Submitting' : 'Submit independent review'}</button>
        <button type="button" onClick={onDone} className="h-10 px-4 text-sm">Cancel</button>
      </div>
    </form>
  );
}

function Inbox() {
  const q = useListReviewerClaims();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Page>
      <section className="mx-auto max-w-5xl px-5 py-12">
        <Kicker className="text-ink/55">Reviewer</Kicker>
        <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold tracking-tight">Claim review inbox</h1>
        <p className="mt-3 text-ink/70 max-w-xl">A submitted review records findings, limitations and evidence. The server decides the resulting label.</p>
        <div className="mt-10">
          {q.isLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <Block key={i} className="h-28" />)}</div>}
          {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
          {q.data && q.data.length === 0 && <Empty kicker="Inbox clear" title="No claims are waiting for review.">New claims appear when organizations publish evidence.</Empty>}
          <ul className="space-y-4">
            {q.data?.map((c) => (
              <li key={c.id} className="rounded-md border border-ink/15 bg-card p-5" data-testid={`row-review-claim-${c.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="meta text-ink/55">{c.organizationName} / <Link href={`/projects/${c.projectId}`} className="underline">{c.projectTitle}</Link></p>
                  <ClaimLabelBadge label={c.label} />
                </div>
                <p className="mt-3 font-medium">{c.text}</p>
                <blockquote className="mt-2 border-l-2 border-vermilion pl-3 text-sm italic text-ink/75">{c.quote}</blockquote>
                <a href={c.sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 font-mono text-xs underline">{hostOf(c.sourceUrl)}<ArrowUpRight className="h-3 w-3" /></a>
                {c.reviews.length > 0 && <p className="mt-2 meta text-ink/50">{c.reviews.length} prior review(s)</p>}
                {open === c.id ? <ReviewForm claim={c} onDone={() => setOpen(null)} /> : (
                  <button type="button" onClick={() => setOpen(c.id)} className="mt-4 h-9 px-4 rounded-sm border border-ink/25 text-sm font-medium hover:bg-ink hover:text-paper" data-testid={`button-review-${c.id}`}>Write review</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </Page>
  );
}

export default function Reviewer() {
  return (
    <OrgGate requireOrg={false}>
      {(me) => me.role === 'reviewer' ? <Inbox /> : (
        <Page>
          <div className="mx-auto max-w-2xl px-5 py-20">
            <Empty kicker="403" title="Reviewer access is assigned by nujli." action={<Link href="/organization" className="underline text-sm">Back to organization</Link>}>
              <span className="inline-flex items-center gap-2"><ShieldOff className="h-4 w-4" />Your account role is "{me.role}". Reviewer status cannot be self-assigned.</span>
            </Empty>
          </div>
        </Page>
      )}
    </OrgGate>
  );
}
