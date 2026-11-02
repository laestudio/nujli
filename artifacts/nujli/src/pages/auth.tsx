import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { SignIn, SignUp } from '@clerk/react';
import { Wordmark } from '@/components/shell';
import { WorldMap } from '@/components/world-map';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function AuthFrame({ children, title, line }: { children: ReactNode; title: string; line: string }) {
  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.1fr_1fr] bg-ink text-paper">
      <div className="relative hidden lg:flex flex-col bg-ink text-paper overflow-hidden">
        <WorldMap interactive={false} className="absolute inset-0 opacity-70" label="Decorative world map" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,11,12,0.3),rgba(11,11,12,0.95))]" />
        <div className="relative p-10"><Link href="/" aria-label="nujli. home"><Wordmark dark className="text-3xl" /></Link></div>
        <div className="relative mt-auto p-10">
          <p className="meta text-paper/55">Impact Revealed.</p>
          <h1 className="mt-3 font-display text-5xl font-bold leading-[0.98] tracking-tight max-w-md">{title}</h1>
          <p className="mt-4 text-paper/70 max-w-sm">{line}</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center px-4 py-10">
        <Link href="/" className="lg:hidden mb-8" aria-label="nujli. home"><Wordmark dark className="text-3xl" /></Link>
        {children}
      </div>
    </div>
  );
}

export function SignInPage() {
  return (
    <AuthFrame title="Back to the evidence." line="Review drafts, confirm media permissions and publish when every line holds up.">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
        forceRedirectUrl={import.meta.env.DEV && new URLSearchParams(window.location.search).get('developer_demo') === '1' ? `${basePath}/billing` : undefined} />
    </AuthFrame>
  );
}

export function SignUpPage() {
  return (
    <AuthFrame title="Prove that you deserve more donations." line="Create an organization account. Donors never need one.">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </AuthFrame>
  );
}
