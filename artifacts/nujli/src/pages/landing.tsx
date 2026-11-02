import { useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, FileSearch, Link2, ShieldCheck, Globe2 } from 'lucide-react';
import { useGetPublicSummary, useListPublicProjects } from '@workspace/api-client-react';
import { Page } from '@/components/shell';
import { WorldMap, type MapMarker } from '@/components/world-map';
import { ClaimLabelBadge, Kicker } from '@/components/states';

export default function Landing() {
  const [, setLocation] = useLocation();
  const summary = useGetPublicSummary();
  const projects = useListPublicProjects();
  const markers = useMemo<MapMarker[]>(() => (projects.data ?? [])
    .filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => ({ id: p.id, lat: p.latitude as number, lng: p.longitude as number, label: p.title })), [projects.data]);

  const count = (n?: number) => (summary.isLoading ? '...' : summary.isError ? '--' : String(n ?? 0));

  return (
    <Page dark tatreez={false}>
      {/* HERO */}
      <section className="relative min-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden">
        <WorldMap markers={markers} wheelZoom={false} drift onSelect={(id) => setLocation(`/projects/${id}`)} className="absolute inset-0" label="Particle map of the world with published projects" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(11,11,12,0.55)_0%,rgba(11,11,12,0.2)_60%,rgba(11,11,12,0.85)_100%)]" />
        <div className="relative flex-1 mx-auto w-full max-w-[900px] px-5 pt-16 pb-44 sm:pb-16 flex flex-col items-center justify-center text-center gap-6 pointer-events-none">
          <p className="meta text-paper/70 rise">Impact Revealed. <span aria-hidden>/</span> <bdi lang="ar" dir="rtl" className="ar normal-case tracking-normal text-sm" title="Arabic tagline, pending fluent-speaker review">الأثر يتجلّى</bdi></p>
          <h1 className="font-display font-bold text-paper text-[clamp(34px,7vw,76px)] leading-[1.05] tracking-[-0.02em] rise" style={{ animationDelay: '80ms' }}>
            Prove that you <span className="hz hero-deserve">deserve</span> more donations.
          </h1>
          <div className="tz rise" aria-hidden style={{ animationDelay: '140ms' }} />
          <Link href="/choose" data-testid="button-show-evidence" className="btn-outline pointer-events-auto text-lg px-8 py-4 rise" style={{ animationDelay: '180ms' }}>
            Show the Evidence <ArrowRight className="h-5 w-5" />
          </Link>
          <Link href="/about" className="pointer-events-auto text-sm text-paper/70 underline underline-offset-4 hover:text-paper" data-testid="link-our-mission">Our mission</Link>
          <dl className="mt-6 grid grid-cols-3 gap-6 sm:gap-10 border-t border-paper/15 pt-5 rise" style={{ animationDelay: '260ms' }}>
            <div><dt className="meta text-paper/50">Projects</dt><dd className="mt-1 font-display text-2xl font-bold text-paper" data-testid="text-count-projects">{count(summary.data?.projects)}</dd></div>
            <div><dt className="meta text-paper/50">Organizations</dt><dd className="mt-1 font-display text-2xl font-bold text-paper" data-testid="text-count-organizations">{count(summary.data?.organizations)}</dd></div>
            <div><dt className="meta text-paper/50">Causes</dt><dd className="mt-1 font-display text-2xl font-bold text-paper">{count(summary.data?.causes.length)}</dd></div>
          </dl>
          {!summary.isLoading && summary.data?.projects === 0 && (
            <p className="meta text-paper/50">The map is empty until the first organization publishes. We do not place example pins.</p>
          )}
        </div>
      </section>

      {/* PROBLEM */}
      <section className="invert-surface bg-paper text-ink">
        <div className="mx-auto max-w-7xl px-5 py-24 grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <Kicker className="text-ink/55">The gap</Kicker>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-bold leading-[1]">Donors have stopped trusting adjectives.</h2>
          </div>
          <div className="space-y-6 text-lg leading-relaxed text-ink/80">
            <p>"Thousands helped." "Life-changing." Every appeal reads the same, and the evidence sits scattered across reports, posts and press pages that nobody connects.</p>
            <p>nujli. reads the public pages you point it at, extracts what they actually say, and keeps the exact quote and link beside every figure. If a number cannot be traced, it does not appear.</p>
          </div>
        </div>
      </section>

      {/* HOW */}
      <section className="invert-surface bg-paper text-ink border-t border-ink/10">
        <div className="mx-auto max-w-7xl px-5 py-24">
          <Kicker className="text-ink/55">How an Impact Page is made</Kicker>
          <ol className="mt-10 grid gap-px bg-ink/15 border border-ink/15 md:grid-cols-4">
            {[
              { i: Link2, t: 'Submit a public URL', d: 'A project page, report or update you already published.' },
              { i: FileSearch, t: 'Extraction with quotes', d: 'Statistics, dated updates, media and claims are drafted with the sentence they came from.' },
              { i: ShieldCheck, t: 'You review and approve', d: 'Correct fields, remove items, confirm photo permissions and that no private beneficiary data appears.' },
              { i: Globe2, t: 'Publish to the map', d: 'A separate step. Unpublish any time. Any edit withdraws approval.' },
            ].map(({ i: Icon, t, d }, n) => (
              <li key={t} className="bg-paper p-6 md:p-8 flex flex-col gap-4 min-h-[220px]">
                <span className="meta text-ink/45">0{n + 1}</span>
                <Icon className="h-6 w-6 text-vermilion-deep" aria-hidden />
                <h3 className="font-display text-xl font-semibold">{t}</h3>
                <p className="text-sm text-ink/70 leading-relaxed">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* LABELS */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-7xl px-5 py-24 grid gap-12 lg:grid-cols-2">
          <div>
            <Kicker className="text-paper/60">Three labels. No more.</Kicker>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-bold leading-[1]">We say exactly how far a claim has been checked.</h2>
            <p className="mt-6 text-paper/70 max-w-md">No software decides a claim is true. Labels describe the evidence trail, nothing else.</p>
            <Link href="/methodology" className="mt-8 inline-flex items-center gap-2 text-paper underline decoration-vermilion underline-offset-4" data-testid="link-methodology">Read the exact definitions <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="space-y-4">
            {([
              ['Organization Reported', 'Stated by the organization on a public page we can link and quote.'],
              ['Corroborated', 'Supported by a separate public source beyond the organization itself.'],
              ['Independently Reviewed', 'An authorized reviewer examined evidence and recorded findings and limitations.'],
            ] as const).map(([l, d]) => (
              <div key={l} className="invert-surface rounded-sm border border-ink/15 bg-paper-2 p-5 text-ink">
                <ClaimLabelBadge label={l} />
                <p className="mt-3 text-sm text-ink/75">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SPLIT CTA */}
      <section className="invert-surface bg-paper text-ink">
        <div className="mx-auto max-w-7xl px-5 py-24 grid gap-6 md:grid-cols-2">
          <Link href="/explore" className="keep-dark raised group rounded-md bg-ink text-paper p-8 md:p-10 min-h-[260px] flex flex-col" data-testid="link-cta-donor">
            <span className="meta text-paper/50">Free, no account</span>
            <span className="mt-4 font-display text-3xl font-bold">Explore the evidence map</span>
            <span className="mt-2 text-paper/70 text-sm max-w-sm">Search by cause, organization or place. Open any project to see the source behind every number.</span>
            <ArrowRight className="mt-auto h-6 w-6 text-vermilion group-hover:translate-x-2 transition-transform" />
          </Link>
          <Link href="/visual-build" className="group rounded-md border border-ink/20 p-8 md:p-10 min-h-[260px] flex flex-col hover:border-ink transition-colors" data-testid="link-cta-visual-build">
            <span className="meta text-ink/50">Concept demo</span>
            <span className="mt-4 font-display text-3xl font-bold">Visual Build</span>
            <span className="mt-2 text-ink/70 text-sm max-w-sm">A conceptual 3D masjid that assembles stage by stage with a simulation slider. Clearly labeled. Never presented as real progress.</span>
            <ArrowRight className="mt-auto h-6 w-6 text-vermilion-deep group-hover:translate-x-2 transition-transform" />
          </Link>
        </div>
      </section>
    </Page>
  );
}
