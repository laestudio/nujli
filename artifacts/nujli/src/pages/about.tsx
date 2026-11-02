import { Link } from 'wouter';
import { Page } from '@/components/shell';

const BLOCKS = [
  { h: 'Our mission', p: 'To make humanitarian impact visible, strengthen donor trust, and help organizations demonstrate the difference they make while reducing administrative work.' },
  { h: 'How we accomplish it', p: 'nujli. transforms humanitarian project data into immersive, evidence-backed experiences where donors can explore real-world progress through interactive maps, photographs, videos, statistics, and 3D visualizations.' },
  { h: 'Our ultimate goal', p: 'To bridge the gap between giving and seeing the difference it makes, creating greater transparency, accountability, and trust in humanitarian organizations.' },
];

export default function About() {
  return (
    <Page dark tatreez={false}>
      <section className="geo-bg weave">
        <div className="mx-auto max-w-[960px] px-5 py-16 md:py-24 grid gap-5">
          <div className="tz" aria-hidden />
          <p className="meta text-paper/60">nujli. | Impact Revealed. <bdi lang="ar" dir="rtl" className="ar normal-case tracking-normal text-sm">الأثر يتجلّى</bdi></p>
          <h1 className="font-display font-bold text-[clamp(40px,9vw,88px)] leading-none tracking-tight">See. Trust. Give.</h1>
          {BLOCKS.map((b) => (
            <div key={b.h} className="rounded-[10px] border border-paper/15 bg-ink-2/90 p-5 md:p-6" data-testid={`card-mission-${b.h.toLowerCase().replace(/\s+/g, '-')}`}>
              <h2 className="font-display text-xl font-bold">{b.h}</h2>
              <p className="mt-2 text-paper/80 leading-relaxed">{b.p}</p>
            </div>
          ))}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/choose" className="btn-outline px-6 py-3" data-testid="button-about-show-evidence">Show the Evidence</Link>
            <Link href="/methodology" className="inline-flex items-center px-2 text-sm text-paper/70 underline underline-offset-4 hover:text-paper">Evidence definitions</Link>
          </div>
          <p className="mt-4 text-xs text-paper/70" data-testid="text-arabic-review-note">Note: the Arabic tagline is pending review by a fluent speaker.</p>
        </div>
      </section>
    </Page>
  );
}
