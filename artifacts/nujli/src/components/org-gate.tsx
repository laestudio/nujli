import { useState, type ReactNode } from 'react';
import { Link, Redirect } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Lock } from 'lucide-react';
import { useSaveOrganization, getGetMeQueryKey } from '@workspace/api-client-react';
import type { Account } from '@workspace/api-client-react';
import { Page, useMe } from '@/components/shell';
import { ErrorState, Kicker, PageSkeleton } from '@/components/states';
import { errMsg, errStatus } from '@/lib/format';

export function SetupOrganization({ me }: { me: Account }) {
  const qc = useQueryClient();
  const [name, setName] = useState(me.organizationName ?? '');
  const [website, setWebsite] = useState(me.website ?? '');
  const save = useSaveOrganization({ mutation: { onSuccess: (acc) => qc.setQueryData(getGetMeQueryKey(), acc) } });
  const valid = name.trim().length >= 2 && /^https?:\/\/\S+\.\S+/.test(website.trim());
  return (
    <section className="mx-auto max-w-2xl px-5 py-16">
      <Kicker className="text-ink/55">Before you generate</Kicker>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Tell donors who you are.</h1>
      <p className="mt-3 text-ink/70">This name appears on every Impact Page you publish. Use the legal or public name donors already know.</p>
      <form className="mt-8 space-y-5" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate({ data: { name: name.trim(), website: website.trim() } }); }}>
        <div>
          <label htmlFor="org-name" className="text-sm font-medium">Organization name</label>
          <input id="org-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} required className="mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3" data-testid="input-org-name" />
        </div>
        <div>
          <label htmlFor="org-web" className="text-sm font-medium">Public website</label>
          <input id="org-web" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" maxLength={2048} required className="mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 font-mono text-sm" data-testid="input-org-website" />
        </div>
        {save.isError && <ErrorState error={save.error} title="Could not save organization." />}
        <button type="submit" disabled={!valid || save.isPending} className="h-11 px-6 rounded-sm bg-ink text-paper font-medium disabled:opacity-40 hover:bg-vermilion hover:text-white transition-colors" data-testid="button-save-organization">
          {save.isPending ? 'Saving' : 'Save organization'}
        </button>
      </form>
    </section>
  );
}

export function EntitlementBanner({ me }: { me: Account }) {
  if (me.entitlement.active) return null;
  return (
    <div className="border border-vermilion/60 bg-vermilion/5 rounded-md p-4 flex flex-wrap items-center gap-3" role="status" data-testid="banner-entitlement">
      <Lock className="h-4 w-4 text-vermilion-deep" aria-hidden />
      <p className="text-sm flex-1 min-w-[200px]"><span className="font-medium">Membership inactive ({me.entitlement.status}).</span> {me.entitlement.message}</p>
      <Link href="/billing" className="text-sm font-medium underline underline-offset-2" data-testid="link-billing">Go to billing</Link>
    </div>
  );
}

export function AiBanner({ me }: { me: Account }) {
  if (me.aiConfigured) return null;
  return (
    <div className="border border-ink/25 rounded-md p-4 flex items-center gap-3 text-sm" role="status">
      <AlertTriangle className="h-4 w-4" aria-hidden /> AI extraction is not configured on the server. Generation will be unavailable until it is.
    </div>
  );
}

/** Requires sign-in and a loaded /me. Optionally requires an organization profile. */
export function OrgGate({ children, requireOrg = true }: { children: (me: Account) => ReactNode; requireOrg?: boolean }) {
  const me = useMe();
  if (!me.authLoaded) return <Page><PageSkeleton /></Page>;
  if (!me.isSignedIn) return <Redirect to="/sign-in" />;
  if (me.isLoading) return <Page><PageSkeleton /></Page>;
  if (me.isError && errStatus(me.error) === 401) return <Page><div className="mx-auto max-w-2xl px-5 py-16"><Kicker className="text-ink/55">Session expired</Kicker><h1 className="mt-3 font-display text-3xl font-bold">Please sign in again.</h1><p className="mt-2 text-ink/70">Your session ended. Your projects and drafts are safe.</p><Link href="/sign-in" className="mt-6 inline-flex h-11 items-center px-5 rounded-sm bg-ink text-paper font-medium" data-testid="link-sign-in-again">Sign in</Link></div></Page>;
  if (me.isError || !me.data) return <Page><div className="mx-auto max-w-2xl px-5 py-16"><ErrorState error={me.error} title="Could not load your account." onRetry={() => me.refetch()} /><p className="sr-only">{errMsg(me.error)}</p></div></Page>;
  if (requireOrg && me.data.role === 'organization' && !me.data.organizationId) return <Page><SetupOrganization me={me.data} /></Page>;
  return <>{children(me.data)}</>;
}
