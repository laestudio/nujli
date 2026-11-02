import { Link } from 'wouter';
import { Page } from '@/components/shell';

export default function Choose() {
  
  return (
    <Page dark footer={false}>
      <section className="geo-bg min-h-[calc(100dvh-4rem)] flex flex-col items-center justify-center text-center gap-6 px-5 py-16">
        <div className="tz rise" aria-hidden />
        <h1 className="font-display text-[32px] md:text-4xl font-bold tracking-tight rise">Who are you?</h1>
        <div className="flex flex-wrap justify-center gap-3 rise" style={{ animationDelay: '100ms' }}>
          <Link href="/explore" data-testid="button-role-donor" className="btn-outline px-6 py-3">I'm a Donor</Link>
          <Link href="/organizations" data-testid="button-role-organization" className="btn-outline px-6 py-3">I'm an Organization</Link>
        </div>
        <p className="max-w-sm text-sm text-paper/60 rise" style={{ animationDelay: '160ms' }}>Donors explore free, without an account. Organizations sign in to turn public pages into source-backed Impact Pages.</p>
        <p className="meta text-paper/40">Reviewer access is granted by nujli., not chosen here.</p>
      </section>
    </Page>
  );
}
