import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import { useGenerateProject, useSubmitProject, getListOrganizationProjectsQueryKey, getGetGenerationJobQueryKey } from '@workspace/api-client-react';
import type { Account, ProjectSubmission } from '@workspace/api-client-react';
import { Page } from '@/components/shell';
import { AiBanner, EntitlementBanner, OrgGate } from '@/components/org-gate';
import { Journey } from '@/components/journey';
import { ErrorState } from '@/components/states';
import { useToast } from '@/hooks/use-toast';
import { errMsg } from '@/lib/format';

const isUrl = (v: string) => /^https?:\/\/\S+\.\S+/.test(v.trim());
const isHttps = (v: string) => /^https:\/\/\S+\.\S+/.test(v.trim());
const RAW_FILE = /\.(pdf|docx?|xlsx?|pptx?|zip)(\?.*)?$/i;
const isPage = (v: string) => isHttps(v) && !RAW_FILE.test(v.trim());
const MAX_EXTRA = 5;

function NewProject({ me }: { me: Account }) {
  const [url, setUrl] = useState('');
  const [extras, setExtras] = useState<string[]>([]);
  const [permission, setPermission] = useState(false);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const submit = useSubmitProject();
  const generate = useGenerateProject();
  const extrasFilled = extras.map((e) => e.trim()).filter(Boolean);
  const extrasValid = extrasFilled.every(isPage);
  const valid = isHttps(url) && extrasValid && permission;
  const busy = submit.isPending || generate.isPending;
  const blocked = !me.entitlement.active || !me.aiConfigured;

  const go = () => {
    const payload: ProjectSubmission = { sourceUrl: url.trim(), permissionsConfirmed: permission, ...(extrasFilled.length ? { extraSourceUrls: extrasFilled } : {}) };
    submit.mutate({ data: payload }, {
      onSuccess: (project) => {
        qc.invalidateQueries({ queryKey: getListOrganizationProjectsQueryKey() });
        generate.mutate({ id: project.id }, {
          onSuccess: (job) => qc.setQueryData(getGetGenerationJobQueryKey(project.id), job),
          onError: (e) => toast({ title: 'Your project was saved, but generation did not start', description: `${errMsg(e)} You can retry from the next screen.`, variant: 'destructive' }),
          onSettled: () => setLocation(`/organization/projects/${project.id}`),
        });
      },
    });
  };

  return (
    <Page>
      <section className="mx-auto max-w-3xl px-5 py-10 md:py-14">
        <Link href="/organization" className="inline-flex items-center gap-1.5 text-sm text-ink/70 hover:text-ink"><ArrowLeft className="h-4 w-4" />My Projects</Link>
        <Journey current="Generate" className="mt-8" />
        <h1 className="mt-10 font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.02]" data-testid="text-generate-headline">Let's bring your impact to life.</h1>
        <div className="mt-8 space-y-4">
          <EntitlementBanner me={me} />
          <AiBanner me={me} />
        </div>
        <form className="mt-8 space-y-7" onSubmit={(e) => { e.preventDefault(); if (valid && !busy && !blocked) go(); }}>
          <div>
            <label htmlFor="src" className="font-display text-lg font-semibold">Paste your project link</label>
            <input id="src" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-organization.org/projects/..." maxLength={2048} required aria-describedby="src-help" className="mt-3 h-14 w-full rounded-sm border border-input bg-card px-4 font-mono text-sm focus:border-ink" data-testid="input-source-url" />
            <p id="src-help" className="mt-2 text-sm text-ink/65">We'll use your published project information to create an interactive donor experience.</p>
            {!!url.trim() && !isHttps(url) && <p role="alert" className="mt-2 text-sm text-vermilion-deep">Use a public link beginning with https://.</p>}
          </div>

          <fieldset>
            <legend className="text-sm font-medium">More published sources <span className="text-ink/50 font-normal">(optional, up to {MAX_EXTRA})</span></legend>
            <p className="mt-1 text-xs text-ink/55">Public https:// links you have approved for use: a report or gallery web page, a direct photo (JPEG, PNG, WebP, GIF, AVIF), or a direct video (MP4, WebM, Ogg). Photos and videos from these links stay pending until you confirm permission for each one during review. PDFs, documents and file uploads are not supported.</p>
            <div className="mt-3 space-y-2">
              {extras.map((x, i) => (
                <div key={i} className="flex gap-2">
                  <input type="url" value={x} onChange={(e) => setExtras(extras.map((v, j) => (j === i ? e.target.value : v)))} placeholder="https://" maxLength={2048} aria-label={`Extra source ${i + 1}`} aria-invalid={!!x.trim() && !isPage(x)} className="h-11 min-w-0 flex-1 rounded-sm border border-input bg-card px-3 font-mono text-sm" data-testid={`input-extra-source-${i}`} />
                  <button type="button" onClick={() => setExtras(extras.filter((_, j) => j !== i))} aria-label={`Remove source ${i + 1}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-sm border border-ink/20 hover:bg-ink hover:text-paper" data-testid={`button-remove-extra-${i}`}><X className="h-4 w-4" /></button>
                </div>
              ))}
              {extras.length < MAX_EXTRA && (
                <button type="button" onClick={() => setExtras([...extras, ''])} className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4" data-testid="button-add-extra-source"><Plus className="h-4 w-4" />Add another published source</button>
              )}
              {!extrasValid && <p className="text-xs text-vermilion-deep">Each extra source must be an https:// web page, photo or video link. PDFs and documents are not supported.</p>}
            </div>
          </fieldset>

          <label className="flex items-start gap-3 rounded-md border border-ink/15 bg-card p-4 cursor-pointer">
            <input type="checkbox" required checked={permission} onChange={(e) => setPermission(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#D42A2F]" data-testid="checkbox-permission" />
            <span className="text-sm leading-relaxed">We published these sources and are authorized to use them to show our work to donors. Each photo and video is still confirmed individually during review. <span className="text-vermilion-deep font-medium">Required</span></span>
          </label>

          <button type="submit" disabled={!valid || busy || blocked} className="h-14 w-full sm:w-auto px-8 rounded-sm bg-ink text-paper font-medium text-base inline-flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-vermilion hover:text-white transition-colors" data-testid="button-submit-project">
            {submit.isPending ? 'Saving your project' : generate.isPending ? 'Starting' : <>Generate My Impact Page <ArrowRight className="h-4 w-4" /></>}
          </button>
          <p className="text-xs text-ink/55">The page must be publicly reachable. Submitting the same links again reopens your existing draft. Nothing is published until you review and publish it.</p>
        </form>
        {submit.isError && <div className="mt-6"><ErrorState error={submit.error} title="We could not save this project." /></div>}
      </section>
    </Page>
  );
}

export default function OrganizationNew() {
  return <OrgGate>{(me) => <NewProject me={me} />}</OrgGate>;
}
