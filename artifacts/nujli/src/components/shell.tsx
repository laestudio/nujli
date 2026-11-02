import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Show, useAuth, useClerk } from '@clerk/react';
import { Menu, X } from 'lucide-react';
import { useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function Wordmark({ className, variant = 'dark' }: { className?: string; dark?: boolean; variant?: 'dark' | 'light' }) {
  return (
    <span className={cn('inline-flex shrink-0 text-2xl leading-none', className)}>
      <img src={`${basePath}/${variant === 'light' ? 'logo-light.svg' : 'logo.svg'}`} alt="nujli." width={356} height={170} className="h-[1.8em] w-auto max-w-full" />
    </span>
  );
}

export function useMe() {
  const { isSignedIn, isLoaded } = useAuth();
  const q = useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled: !!isSignedIn, retry: 1 } });
  return { ...q, isSignedIn: !!isSignedIn, authLoaded: isLoaded };
}

function NavLink({ href, children, dark, onClick }: { href: string; children: ReactNode; dark?: boolean; onClick?: () => void }) {
  const [loc] = useLocation();
  const active = loc === href || (href !== '/' && loc.startsWith(href + '/'));
  return (
    <Link
      href={href}
      onClick={onClick}
      data-testid={`link-nav-${href.replace(/\//g, '') || 'home'}`}
      className={cn('relative px-1 py-1 text-sm font-medium transition-colors',
        dark ? 'text-paper/70 hover:text-paper' : 'text-ink/65 hover:text-ink',
        active && (dark ? 'text-paper' : 'text-ink'))}
    >
      {children}
      {active && <span className="absolute -bottom-0.5 left-1 right-1 h-px bg-vermilion" />}
    </Link>
  );
}

export function Header({ dark }: { dark?: boolean }) {
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!headerRef.current) return;
    const update = () => document.documentElement.style.setProperty('--app-header-height', `${headerRef.current?.getBoundingClientRect().height ?? 64}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);
  const [open, setOpen] = useState(false);
  const { signOut } = useClerk();
  const { data: me } = useMe();
  const close = () => setOpen(false);
  const links = (
    <>
      <NavLink href="/explore" dark={dark} onClick={close}>Explore map</NavLink>
      <NavLink href="/about" dark={dark} onClick={close}>Our mission</NavLink>
      <NavLink href="/methodology" dark={dark} onClick={close}>Methodology</NavLink>
      <NavLink href="/visual-build" dark={dark} onClick={close}>Visual Build</NavLink>
      <Show when="signed-in">
        <NavLink href="/organization" dark={dark} onClick={close}>Organization</NavLink>
        <NavLink href="/billing" dark={dark} onClick={close}>Billing</NavLink>
        {me?.role === 'reviewer' && <NavLink href="/reviewer" dark={dark} onClick={close}>Reviewer</NavLink>}
      </Show>
    </>
  );
  const btn = cn('inline-flex min-h-11 items-center text-sm font-medium px-3.5 py-2 rounded-sm border transition-colors',
    dark ? 'border-paper/25 text-paper hover:bg-paper hover:text-ink' : 'border-ink/25 text-ink hover:bg-ink hover:text-paper');
  return (
    <header ref={headerRef} className={cn('sticky top-0 z-40 border-b backdrop-blur', dark ? 'bg-ink/85 border-paper/10' : 'bg-paper/85 border-ink/10')}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 bg-vermilion text-white px-3 py-1 rounded-sm">Skip to content</a>
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2 min-w-0">
        <Link href="/" data-testid="link-home" aria-label="nujli. home" className="flex min-h-11 min-w-0 max-w-full flex-wrap items-center gap-x-2">
          <Wordmark dark={dark} />
          <bdi lang="ar" dir="rtl" className={cn('ar text-lg', dark ? 'text-paper/65' : 'text-ink/65')}>فلسطين</bdi>
        </Link>
        <nav className="ml-auto hidden lg:flex items-center gap-5" aria-label="Primary">{links}</nav>
        <div className="ml-auto lg:ml-2 flex flex-wrap items-center gap-2 min-w-0">
          <Show when="signed-out">
            <Link href="/sign-in" className={btn} data-testid="link-sign-in">Sign in</Link>
          </Show>
          <Show when="signed-in">
            <button type="button" className={cn(btn, 'hidden sm:inline-flex')} onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out">Sign out</button>
          </Show>
          <button type="button" className={cn('lg:hidden grid h-11 w-11 place-items-center rounded-sm', dark ? 'text-paper' : 'text-ink')} aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)} data-testid="button-menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Mobile" className={cn('lg:hidden border-t px-5 py-4 flex flex-col gap-3', dark ? 'border-paper/10 bg-ink' : 'border-ink/10 bg-paper')}>
          {links}
          <Show when="signed-in">
            <button type="button" className={cn('text-left text-sm font-medium', dark ? 'text-paper/70' : 'text-ink/70')} onClick={() => signOut({ redirectUrl: basePath || '/' })}>Sign out</button>
          </Show>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="keep-dark bg-ink text-paper border-t border-paper/10">
      <div className="mx-auto max-w-7xl px-5 py-14 grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <div className="flex flex-wrap items-baseline gap-3"><Wordmark dark className="text-4xl" /><bdi lang="ar" dir="rtl" className="ar text-xl text-paper/75">فلسطين</bdi></div>
          <p className="meta mt-3 text-paper/75">Impact Revealed. <bdi lang="ar" dir="rtl" className="ar normal-case tracking-normal text-sm">الأثر يتجلّى</bdi></p>
          <div className="tz mt-5" aria-hidden />
          <p className="mt-5 max-w-sm text-sm text-paper/65 leading-relaxed">Every figure on nujli. links back to the public page it came from. If a source cannot be shown, the claim is not published.</p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="meta text-paper/75 mb-1">Donors</p>
          <Link href="/about" className="text-paper/75 hover:text-paper" data-testid="link-footer-mission">Our mission</Link>
          <Link href="/explore" className="text-paper/75 hover:text-paper">Explore the map</Link>
          <Link href="/methodology" className="text-paper/75 hover:text-paper">Evidence definitions</Link>
          <Link href="/visual-build" className="text-paper/75 hover:text-paper">Visual Build</Link>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="meta text-paper/75 mb-1">Organizations</p>
          <Link href="/sign-up" className="text-paper/75 hover:text-paper">Create an account</Link>
          <Link href="/organization" className="text-paper/75 hover:text-paper">Dashboard</Link>
          <Link href="/billing" className="text-paper/75 hover:text-paper">Billing</Link>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-5 pb-8 meta text-paper/75">No statistics on this site are produced by nujli. They are quoted from linked sources.</div>
    </footer>
  );
}

export function Page({ children, dark, footer = true, tatreez = true }: { children: ReactNode; dark?: boolean; footer?: boolean; tatreez?: boolean }) {
  return (
    <div className={cn('min-h-[100dvh] flex flex-col grain', dark ? 'bg-ink text-paper' : 'invert-surface bg-paper text-ink')}>
      <Header dark={dark} />
      {tatreez && <div className="tz page-tz" aria-hidden data-testid="decor-page-tatreez" />}
      <main id="main" className="flex-1 weave">{children}</main>
      {footer && <Footer />}
    </div>
  );
}
