import { useEffect, useRef, type ReactNode } from 'react';
import { ClerkProvider, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import Choose from '@/pages/choose';
import Explore from '@/pages/explore';
import PublicProject from '@/pages/project';
import VisualBuild from '@/pages/visual-build';
import Methodology from '@/pages/methodology';
import About from '@/pages/about';
import Organizations from '@/pages/organizations';
import OrganizationPage from '@/pages/organization';
import OrganizationNew from '@/pages/organization-new';
import OrganizationProject from '@/pages/organization-project';
import Billing from '@/pages/billing';
import Reviewer from '@/pages/reviewer';
import { SignInPage, SignUpPage } from '@/pages/auth';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#F3ECDD',
    colorForeground: '#F3ECDD',
    colorMutedForeground: '#B9B4AA',
    colorDanger: '#E5585C',
    colorBackground: '#141416',
    colorInput: '#0A0908',
    colorInputForeground: '#F3ECDD',
    colorNeutral: '#F3ECDD',
    fontFamily: "'Inter', ui-sans-serif, sans-serif",
    borderRadius: '0.375rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#141416] rounded-md w-[440px] max-w-full overflow-hidden border border-[#F3ECDD]/15 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.6)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: "text-[#F3ECDD] font-bold tracking-tight [font-family:'Space_Grotesk',sans-serif] text-2xl",
    headerSubtitle: 'text-[#B9B4AA]',
    socialButtonsBlockButtonText: 'text-[#F3ECDD] font-medium',
    formFieldLabel: 'text-[#F3ECDD] font-medium',
    footerActionLink: 'text-[#E5585C] font-medium hover:text-[#F3ECDD]',
    footerActionText: 'text-[#B9B4AA]',
    dividerText: 'text-[#B9B4AA]',
    identityPreviewEditButton: 'text-[#E5585C]',
    formFieldSuccessText: 'text-[#F3ECDD]',
    alertText: 'text-[#F3ECDD]',
    logoBox: 'h-20 justify-center',
    logoImage: 'h-16 w-auto',
    socialButtonsBlockButton: 'border border-[#F3ECDD]/20 bg-[#0A0908]',
    formButtonPrimary: 'bg-[#F3ECDD] text-[#0A0908] font-medium',
    formFieldInput: 'border border-[#F3ECDD]/25 bg-[#0A0908] text-[#F3ECDD]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#F3ECDD]/15',
    alert: 'border border-[#D42A2F]/50 bg-[#D42A2F]/10',
    otpCodeFieldInput: 'border border-[#F3ECDD]/30 text-[#F3ECDD]',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/organization" />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo({top:0,left:0,behavior:"instant"}); }, [location]);
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Routes() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/choose" component={Choose} />
        <Route path="/explore" component={Explore} />
        <Route path="/projects/:id" component={PublicProject} />
        <Route path="/visual-build" component={VisualBuild} />
        <Route path="/methodology" component={Methodology} />
        <Route path="/about" component={About} />
        <Route path="/organizations" component={Organizations} />
        <Route path="/organization" component={OrganizationPage} />
        <Route path="/organization/new" component={OrganizationNew} />
        <Route path="/organization/projects/:id" component={OrganizationProject} />
        <Route path="/billing" component={Billing} />
        <Route path="/reviewer" component={Reviewer} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Sign in to nujli.', subtitle: 'Your evidence is waiting for review' } },
        signUp: { start: { title: 'Create your organization account', subtitle: 'Every published number will link to its source' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Routes />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
