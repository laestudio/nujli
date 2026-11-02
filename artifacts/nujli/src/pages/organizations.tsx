import { Link } from 'wouter';
import { ArrowRight, ArrowUpRight, FileText, Globe2, Layers, ShieldCheck } from 'lucide-react';
import { useListPublicProjects } from '@workspace/api-client-react';
import { Page } from '@/components/shell';
import { Journey, STAGES } from '@/components/journey';
import { Block, Kicker } from '@/components/states';

const STAGE_COPY: Record<string, string> = {
  Choose: 'You told us you are an organization. That is the first step done.',
  Pay: 'Activate membership. Price and terms come live from the billing provider.',
  Generate: 'Paste one link to a project you already published. AI reads it and builds the page.',
  Review: 'See the private preview first. Approve it, or correct and remove what is wrong.',
  Publish: 'One click puts your Impact Page on the public map, ready to share.',
};

export default function Organizations() {
  const pub = useListPublicProjects();
  const firstReal = (pub.data ?? []).find((p) => !p.isSample && p.status === 'published');

  return (
    <Page dark>
      <section className="geo-bg relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-5 pt-16 pb-20 md:pt-24 md:pb-28">
          <Kicker className="text-paper/60 rise">For organizations</Kicker>
          <h1 className="mt-5 font-display font-bold tracking-[-0.02em] leading-[1.02] text-[clamp(38px,8vw,88px)] rise" style={{ animationDelay: '60ms' }} data-testid="text-org-headline">
            Your impact deserves to be <span className="hz">seen.</span>
          </h1>
          <div className="tz mt-8 rise" aria-hidden style={{ animationDelay: '120ms' }} />
          <p className="mt-8 max-w-2xl text-lg md:text-xl text-paper/75 leading-relaxed rise" style={{ animationDelay: '160ms' }} data-testid="text-org-subhead">
            Turn your existing project reports, photographs, videos, and published evidence into an immersive donor experience, powered by AI.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4 rise" style={{ animationDelay: '220ms' }}>
            <Link href="/billing" className="btn-outline text-lg px-7 py-4" data-testid="button-create-impact-page">
              Create Your Impact Page <ArrowRight className="h-5 w-5" />
            </Link>
            <span className="text-sm text-paper/55">No registration needed to look around first.</span>
          </div>
        </div>
      </section>

      <section className="border-t border-paper/10">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <p className="meta text-paper/50">How it works</p>
          <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold tracking-tight">Five stages. You stay in control of every one.</h2>
          <Journey current="Choose" dark className="mt-10" />
          <ol className="mt-10 grid gap-px bg-paper/10 border border-paper/10 rounded-md overflow-hidden md:grid-cols-5">
            {STAGES.map((s, i) => (
              <li key={s} className="bg-ink p-5">
                <p className="font-mono text-xs text-vermilion">0{i + 1}</p>
                <p className="mt-2 font-display text-lg font-semibold">{s}</p>
                <p className="mt-2 text-sm text-paper/65 leading-relaxed">{STAGE_COPY[s]}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-paper/10">
        <div className="mx-auto max-w-5xl px-5 py-16 grid gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="meta text-paper/50">What goes in</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Only what you already published.</h2>
            <p className="mt-4 text-paper/70 leading-relaxed">We never invent numbers or media. Every figure on your page links back to the public report, photo page, or video page it came from. If a source cannot be shown, the claim does not appear.</p>
          </div>
          <ul className="space-y-4">
            {[
              [FileText, 'Project reports', 'Annual reports, field updates and project pages on your site.'],
              [Layers, 'Photographs and videos', 'Shown only after you confirm you have permission for each item.'],
              [ShieldCheck, 'Evidence labels', 'Organization Reported, Corroborated, or Independently Reviewed. Set by evidence, not by you.'],
              [Globe2, 'One shareable page', 'On the public map, with a link you can send to supporters.'],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof FileText;
              return (
                <li key={t as string} className="flex gap-4 border-b border-paper/10 pb-4">
                  <I className="h-5 w-5 mt-0.5 text-vermilion shrink-0" aria-hidden />
                  <div><p className="font-medium">{t as string}</p><p className="text-sm text-paper/60">{d as string}</p></div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="border-t border-paper/10" data-testid="section-demo">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <p className="meta text-paper/50">See it without signing up</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">What donors see today.</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <Link href="/explore" className="group rounded-md border border-paper/15 p-5 hover:border-vermilion transition-colors" data-testid="link-demo-map">
              <p className="meta text-paper/50">Live</p>
              <p className="mt-2 font-display text-xl font-semibold flex items-center gap-2">The public map <ArrowUpRight className="h-4 w-4 group-hover:text-vermilion" /></p>
              <p className="mt-2 text-sm text-paper/60">Every published Impact Page, placed where the work happens.</p>
            </Link>
            <Link href="/visual-build" className="group rounded-md border border-paper/15 p-5 hover:border-vermilion transition-colors" data-testid="link-demo-visual-build">
              <p className="meta text-paper/50">Live</p>
              <p className="mt-2 font-display text-xl font-semibold flex items-center gap-2">Visual Build <ArrowUpRight className="h-4 w-4 group-hover:text-vermilion" /></p>
              <p className="mt-2 text-sm text-paper/60">Documented progress shown as stages, tied to its source.</p>
            </Link>
            {pub.isLoading ? (
              <Block className="h-[132px] bg-paper/10" />
            ) : firstReal ? (
              <Link href={`/projects/${firstReal.id}`} className="group rounded-md border border-paper/15 p-5 hover:border-vermilion transition-colors" data-testid="link-demo-project">
                <p className="meta text-paper/50">Published by {firstReal.organizationName}</p>
                <p className="mt-2 font-display text-xl font-semibold flex items-center gap-2 break-words">{firstReal.title || 'Untitled project'} <ArrowUpRight className="h-4 w-4 shrink-0 group-hover:text-vermilion" /></p>
                <p className="mt-2 text-sm text-paper/60">A real Impact Page, exactly as donors see it.</p>
              </Link>
            ) : (
              <div className="rounded-md border border-dashed border-paper/20 p-5" data-testid="state-demo-unavailable">
                <p className="meta text-paper/50">Unavailable</p>
                <p className="mt-2 font-display text-xl font-semibold">No published project yet</p>
                <p className="mt-2 text-sm text-paper/60">{pub.isError ? 'We could not load published projects right now.' : 'When the first organization publishes, its page will be linked here.'}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-paper/10">
        <div className="mx-auto max-w-5xl px-5 py-20 text-center">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">Your impact deserves to be seen.</h2>
          <Link href="/billing" className="btn-outline mt-8 inline-flex text-lg px-7 py-4" data-testid="button-create-impact-page-bottom">
            Create Your Impact Page <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </Page>
  );
}
