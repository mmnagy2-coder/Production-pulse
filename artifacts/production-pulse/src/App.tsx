import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import ProjectWorkspace from "@/pages/project-workspace";
import ProjectBoard from "@/pages/project-board";
import ProjectTimeline from "@/pages/project-timeline";
import { ThemeProvider } from "@/contexts/theme";
import { TeachModeProvider } from "@/contexts/teach-mode";
import { DemoProvider, useDemo } from "@/contexts/demo";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

// LOCAL DEV BYPASS: normally this throws without a real Clerk key. No Clerk
// app is configured in this local checkout, so we fall back to demo-only
// routing (see DemoOnlyRoutes below) instead of hard-failing on boot.
// publishableKeyFromHost() always synthesizes a fallback key from the
// hostname when none is given, so clerkPubKey itself is never falsy here —
// check the raw env var instead.
const hasClerk = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!hasClerk) {
  console.warn('[dev] VITE_CLERK_PUBLISHABLE_KEY not set — running in demo-only mode, sign-in/sign-up disabled.');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(349 73% 44%)",
    colorForeground: "hsl(0 0% 0%)",
    colorMutedForeground: "hsl(0 0% 40%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(0 0% 98%)",
    colorInputForeground: "hsl(0 0% 0%)",
    colorNeutral: "hsl(0 0% 90%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.25rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded max-w-[440px] w-full overflow-hidden border border-[hsl(0_0%_90%)] shadow-sm",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-serif text-2xl font-medium",
    headerSubtitle: "text-sm text-gray-500",
    socialButtonsBlockButtonText: "text-sm font-medium",
    formFieldLabel: "text-sm font-medium",
    footerActionLink: "text-[hsl(349_73%_44%)] hover:text-[hsl(349_73%_30%)]",
    footerActionText: "text-sm text-gray-500",
    dividerText: "text-sm text-gray-500",
    identityPreviewEditButton: "text-[hsl(349_73%_44%)]",
    formFieldSuccessText: "text-sm text-green-600",
    alertText: "text-sm text-red-600",
    logoBox: "flex justify-center mb-4",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "rounded border border-gray-200 hover:bg-gray-50",
    formButtonPrimary: "bg-[hsl(349_73%_44%)] hover:bg-[hsl(349_73%_34%)] text-white rounded font-medium",
    formFieldInput: "rounded border-gray-200 bg-gray-50 text-black",
    footerAction: "mt-4",
    dividerLine: "bg-gray-200",
    alert: "bg-red-50 border border-red-100 rounded",
    otpCodeFieldInput: "border-gray-200 rounded",
    formFieldRow: "gap-2",
    main: "flex flex-col gap-4",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { isDemo, isLoading: isDemoLoading } = useDemo();

  if (!isLoaded || isDemoLoading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSignedIn || isDemo) {
    return <>{children}</>;
  }

  return <Redirect to="/" />;
}

function ProtectedDashboard() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}

function ProtectedProjectWorkspace({ params }: { params: { id: string, stage?: string } }) {
  return (
    <ProtectedRoute>
      <ProjectWorkspace id={params.id} stage={params.stage} />
    </ProtectedRoute>
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
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to access your projects",
          },
        },
        signUp: {
          start: {
            title: "Join Production Pulse",
            subtitle: "Create an account to start managing your projects",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            <Route path="/dashboard" component={ProtectedDashboard} />
            <Route path="/board">
              <ProtectedRoute><ProjectBoard /></ProtectedRoute>
            </Route>
            <Route path="/projects/:id/timeline">
              {(params) => (
                <ProtectedRoute><ProjectTimeline id={params.id} /></ProtectedRoute>
              )}
            </Route>
            <Route path="/projects/:id" component={ProtectedProjectWorkspace} />
            <Route path="/projects/:id/:stage" component={ProtectedProjectWorkspace} />
            
            <Route>
              <div className="flex h-[100dvh] w-full items-center justify-center bg-gray-50">
                <div className="text-center">
                  <h1 className="text-2xl font-serif text-black mb-2">404 - Not Found</h1>
                  <p className="text-gray-500">The page you're looking for doesn't exist.</p>
                </div>
              </div>
            </Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

// LOCAL DEV BYPASS: demo-only equivalents of ProtectedRoute/the router that
// don't touch Clerk hooks (they'd throw outside a ClerkProvider). Sign-in/
// sign-up routes just bounce home since there's no auth to hand off to.
function DemoOnlyProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isDemo, isLoading: isDemoLoading } = useDemo();

  if (isDemoLoading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isDemo) {
    return <>{children}</>;
  }

  return <Redirect to="/" />;
}

function DemoOnlyRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/sign-in/*?"><Redirect to="/" /></Route>
          <Route path="/sign-up/*?"><Redirect to="/" /></Route>

          <Route path="/dashboard">
            <DemoOnlyProtectedRoute><Dashboard /></DemoOnlyProtectedRoute>
          </Route>
          <Route path="/board">
            <DemoOnlyProtectedRoute><ProjectBoard /></DemoOnlyProtectedRoute>
          </Route>
          <Route path="/projects/:id/timeline">
            {(params) => (
              <DemoOnlyProtectedRoute><ProjectTimeline id={params.id} /></DemoOnlyProtectedRoute>
            )}
          </Route>
          <Route path="/projects/:id">
            {(params) => (
              <DemoOnlyProtectedRoute><ProjectWorkspace id={params.id} /></DemoOnlyProtectedRoute>
            )}
          </Route>
          <Route path="/projects/:id/:stage">
            {(params) => (
              <DemoOnlyProtectedRoute><ProjectWorkspace id={params.id} stage={params.stage} /></DemoOnlyProtectedRoute>
            )}
          </Route>

          <Route>
            <div className="flex h-[100dvh] w-full items-center justify-center bg-gray-50">
              <div className="text-center">
                <h1 className="text-2xl font-serif text-black mb-2">404 - Not Found</h1>
                <p className="text-gray-500">The page you're looking for doesn't exist.</p>
              </div>
            </div>
          </Route>
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <TeachModeProvider>
        <DemoProvider>
          <WouterRouter base={basePath}>
            {hasClerk ? <ClerkProviderWithRoutes /> : <DemoOnlyRoutes />}
          </WouterRouter>
        </DemoProvider>
      </TeachModeProvider>
    </ThemeProvider>
  );
}

export default App;
