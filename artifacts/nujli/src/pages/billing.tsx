import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, BadgeCheck, Ban, RefreshCw } from 'lucide-react';
import { useCreateCheckout, useGetBillingPackage, useVerifyMembership, useSetDeveloperAccess, getGetMeQueryKey } from '@workspace/api-client-react';
import { Page, useMe } from '@/components/shell';
import { Journey } from '@/components/journey';
import { Block, ErrorState, Kicker } from '@/components/states';
import { fmtDate, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { WhopProduct } from '@/components/whop-product';

export default function Billing() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const me = useMe();
  const pkg = useGetBillingPackage();
  const checkout = useCreateCheckout({
    mutation: {
      onSuccess: (res) => { if (res?.url && /^https?:\/\//.test(res.url)) window.location.assign(res.url); },
    },
  });
  const verify = useVerifyMembership({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getGetMeQueryKey() }) } });
  const developer = useSetDeveloperAccess({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getGetMeQueryKey() }) } });
  const p = pkg.data;
  const ent = verify.data ?? me.data?.entitlement;
  const badUrl = checkout.isSuccess && !(checkout.data?.url && /^https?:\/\//.test(checkout.data.url));

  return (
    <Page>
      <section className="mx-auto max-w-5xl px-5 py-14 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0">
          <Journey current="Pay" className="mb-8" />
          {me.data?.developerEligible && <div className="mb-6 rounded-md border border-vermilion p-4" data-testid="developer-skip-panel">
            <p className="text-sm font-medium">Temporary developer demo</p>
            <p className="mt-1 text-sm text-ink/75">Skip payment and try Generate → Review → Publish. No charge, no verified purchase.</p>
            <button type="button" className="mt-3 inline-flex min-h-11 items-center rounded-sm bg-vermilion px-5 font-semibold text-white disabled:opacity-50"
              data-testid="button-skip-payment" disabled={developer.isPending}
              onClick={() => {
                if (!me.data?.organizationId) { navigate('/organization'); return; }
                developer.mutate({data:{enabled:true}}, {onSuccess: access => {
                  if (access.active && access.status === 'developer') navigate('/organization/new');
                }});
              }}>
              {developer.isPending ? 'Opening developer demo…' : 'Skip payment — developer demo'}
            </button>
            {developer.isError && <div className="mt-3"><ErrorState error={developer.error} title="Could not open developer demo." /></div>}
            {developer.isSuccess && !developer.data.active && <p role="alert" className="mt-3 text-sm">{developer.data.message}</p>}
          </div>}
          <Kicker className="text-ink/55">Billing</Kicker>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold tracking-tight">Membership</h1>
          <p className="mt-3 text-ink/70 max-w-md">View the official Whop product below. Access is granted only after the server confirms your membership.</p>

          <WhopProduct linkedCheckoutReady={p?.checkoutReady === true} />

          <div className="keep-dark raised mt-8 rounded-md bg-ink text-paper p-6 md:p-8" data-testid="card-package">
            {pkg.isLoading && <div className="space-y-3"><Block className="h-4 w-24 bg-paper/10" /><Block className="h-10 w-40 bg-paper/10" /><Block className="h-4 w-full bg-paper/10" /></div>}
            {pkg.isError && <div className="text-ink"><ErrorState error={pkg.error} title="Could not load the package." onRetry={() => pkg.refetch()} /></div>}
            {p && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="meta text-paper/60">{p.name}</p>
                  <span className={cn('meta px-2 py-0.5 rounded-sm', p.status === 'ready' ? 'bg-paper text-ink' : 'bg-vermilion text-white')} data-testid="status-package">{p.status}</span>
                </div>
                {p.price !== null && p.price !== undefined ? (
                  <p className="mt-4 font-display text-5xl font-bold" data-testid="text-price">{money(p.price, p.currency)}</p>
                ) : <p className="mt-4 font-display text-2xl font-semibold text-paper/80">Price not available from provider</p>}
                <ul className="mt-3 space-y-1 text-sm text-paper/75" data-testid="list-terms">
                  <li>{p.billingPeriodDays ? `Renews every ${p.billingPeriodDays} day${p.billingPeriodDays === 1 ? '' : 's'}` : 'Billing period not provided by the provider'}</li>
                  {p.currency && <li>Charged in {p.currency.toUpperCase()}</li>}
                  {p.trialDays ? <li className="text-vermilion">{p.trialDays}-day trial offered by the provider</li> : null}
                </ul>
                <p className="mt-4 text-sm text-paper/75" data-testid="text-package-message">{p.message}</p>
                {(p.status === 'blocked' || !p.checkoutReady) && (
                  <div className="mt-4 rounded-sm border border-vermilion/60 p-3 text-sm" role="alert" data-testid="state-checkout-unavailable">
                    <p className="inline-flex items-center gap-2 font-medium text-vermilion"><Ban className="h-4 w-4" />Organization-linked checkout is unavailable.</p>
                    <p className="mt-1 text-paper/70">{p.message || 'The billing provider is not configured.'} The official Whop page is available above, but direct purchases cannot currently be linked automatically to your organization.</p>
                  </div>
                )}
                <div className="mt-6 flex flex-wrap gap-3">
                  {me.data?.entitlement.active ? (
                    <Link href="/organization/new" className="inline-flex items-center gap-2 h-11 px-5 rounded-sm bg-vermilion text-white font-medium" data-testid="link-continue-generate">Membership active. Continue to Generate <ArrowUpRight className="h-4 w-4" /></Link>
                  ) : me.isSignedIn ? (
                    <button type="button" onClick={() => checkout.mutate()} disabled={!p.checkoutReady || checkout.isPending} className="inline-flex items-center gap-2 h-11 px-5 rounded-sm bg-vermilion text-white font-medium disabled:opacity-40" data-testid="button-checkout">
                      {checkout.isPending ? 'Opening checkout' : 'Continue to checkout'} <ArrowUpRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <Link href="/sign-in" className="inline-flex items-center gap-2 h-11 px-5 rounded-sm bg-vermilion text-white font-medium" data-testid="link-sign-in-checkout">Sign in to subscribe</Link>
                  )}
                  {p.productUrl && <a href={p.productUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm underline text-paper/80">Open official Whop product <ArrowUpRight className="h-3 w-3" /></a>}
                </div>
              </>
            )}
          </div>
          {checkout.isError && <div className="mt-4"><ErrorState error={checkout.error} title="Checkout could not be created." /></div>}
          {badUrl && <p className="mt-4 text-sm text-vermilion-deep">The server did not return a checkout URL. Nothing was charged.</p>}
        </div>

        <div className="space-y-5">
          {me.data?.developerEligible && <section className="rounded-md border border-ink/25 p-6" aria-label="Developer access">
            <h2 className="font-display text-xl">Developer access</h2>
            <p className="mt-2 text-sm text-ink/80">Use the generator, private previews, review and publishing without paying in this development instance. This is not a verified purchase and does not grant independent-review privileges.</p>
            {!me.data.organizationId ? <Link href="/organization" className="mt-4 inline-flex min-h-11 items-center underline">Set up your organization first</Link> :
              <button type="button" disabled={developer.isPending} onClick={() => developer.mutate({data:{enabled:ent?.status !== 'developer'}})}
                className="mt-4 inline-flex min-h-11 items-center rounded-sm border border-vermilion px-5 font-medium disabled:opacity-50" data-testid="button-developer-access">
                {developer.isPending ? 'Updating access…' : ent?.status === 'developer' ? 'Turn off developer access' : 'Enable developer access'}
              </button>}
            {ent?.status === 'developer' && <div className="mt-3 flex flex-wrap gap-4"><Link href="/organization" className="inline-flex min-h-11 items-center underline">My Projects</Link><Link href="/organization/new" className="inline-flex min-h-11 items-center underline">Open Generator</Link></div>}
            {developer.isError && <div className="mt-3"><ErrorState error={developer.error} title="Developer access could not be changed." /></div>}
            {developer.isSuccess && <p role="status" className="mt-3 text-sm">{developer.data.message}</p>}
          </section>}
          <div className="rounded-md border border-ink/15 p-6" data-testid="card-entitlement">
            <p className="meta text-ink/55">Your access</p>
            {!me.isSignedIn ? <p className="mt-3 text-sm">Sign in to see your membership.</p> : me.isLoading ? <Block className="mt-3 h-12" /> : me.isError ? <div className="mt-3"><ErrorState error={me.error} onRetry={() => me.refetch()} /></div> : ent && (
              <>
                <p className={cn('mt-3 font-display text-2xl font-bold inline-flex items-center gap-2', ent.active ? 'text-ink' : 'text-vermilion-deep')} data-testid="text-entitlement-status">
                  {ent.active ? <BadgeCheck className="h-6 w-6" /> : <Ban className="h-6 w-6" />}{ent.active ? 'Active' : 'Inactive'}
                </p>
                <p className="meta mt-1 text-ink/55">Status: {ent.status}{ent.expiresAt ? ` / until ${fmtDate(ent.expiresAt)}` : ''}</p>
                <p className="mt-3 text-sm text-ink/75">{ent.message}</p>
              </>
            )}
            {me.isSignedIn && (
              <button type="button" onClick={() => verify.mutate()} disabled={verify.isPending} className="mt-5 inline-flex items-center gap-2 h-10 px-4 rounded-sm border border-ink/25 text-sm font-medium hover:bg-ink hover:text-paper disabled:opacity-40" data-testid="button-verify-membership">
                <RefreshCw className={cn('h-4 w-4', verify.isPending && 'animate-spin')} />{verify.isPending ? 'Checking with server' : 'I completed checkout, verify'}
              </button>
            )}
            {verify.isError && <div className="mt-4"><ErrorState error={verify.error} title="Verification failed." /></div>}
            {verify.isSuccess && <p className="mt-3 text-xs text-ink/60" role="status">Server checked just now.</p>}
          </div>
          <p className="text-xs text-ink/55 leading-relaxed">Donors never pay to explore. Membership covers generating and publishing Impact Pages for one organization.</p>
        </div>
      </section>
    </Page>
  );
}
