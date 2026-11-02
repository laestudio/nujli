import { Link } from 'wouter';
import { Page } from '@/components/shell';

export default function NotFound() {
  return (
    <Page dark footer={false}>
      <section className="mx-auto max-w-3xl px-5 py-24 md:py-36">
        <p className="meta text-paper/50">404 / no source found</p>
        <h1 className="mt-4 font-display text-5xl md:text-7xl font-bold tracking-tight">This page has no evidence<span className="text-vermilion">.</span></h1>
        <p className="mt-5 text-paper/70 max-w-md">The link may be wrong, or the page was removed. We would rather show nothing than invent something.</p>
        <div className="mt-8 flex gap-3">
          <Link href="/" className="h-11 px-5 inline-flex items-center rounded-sm bg-paper text-ink font-medium" data-testid="link-home-404">Home</Link>
          <Link href="/explore" className="h-11 px-5 inline-flex items-center rounded-sm border border-paper/25 font-medium" data-testid="link-explore-404">Explore map</Link>
        </div>
      </section>
    </Page>
  );
}
