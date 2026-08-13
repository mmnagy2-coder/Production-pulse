import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from 'wouter';
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import ProjectWorkspace from "@/pages/project-workspace";
import ProjectBoard from "@/pages/project-board";
import ProjectTimeline from "@/pages/project-timeline";
import SignIn from "@/pages/sign-in";
import SignUp from "@/pages/sign-up";
import { ThemeProvider } from "@/contexts/theme";
import { TeachModeProvider } from "@/contexts/teach-mode";
import { DemoProvider, useDemo } from "@/contexts/demo";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { getAccessToken } from "@/lib/supabase";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Every generated API hook goes through customFetch, which calls this before
// each request and attaches `Authorization: Bearer <token>` when signed in.
// Demo sessions are cookie-based instead, and need no token.
setAuthTokenGetter(getAccessToken);

function LoadingScreen() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

/**
 * Clears cached queries when the signed-in user changes, so one account never
 * sees another's data from the React Query cache.
 */
function QueryCacheInvalidator() {
  const { user, isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return;
    const userId = user?.id ?? null;
    if (
      prevUserIdRef.current !== undefined &&
      prevUserIdRef.current !== userId
    ) {
      queryClient.clear();
    }
    prevUserIdRef.current = userId;
  }, [user, isLoaded, queryClient]);

  return null;
}

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return <LoadingScreen />;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <Home />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { isDemo, isLoading: isDemoLoading } = useDemo();

  if (!isLoaded || isDemoLoading) {
    return <LoadingScreen />;
  }

  if (isSignedIn || isDemo) {
    return <>{children}</>;
  }

  return <Redirect to="/" />;
}

/** Bounces signed-in users away from the sign-in/sign-up pages. */
function GuestOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return <LoadingScreen />;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <>{children}</>;
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

function Routes() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <QueryCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in">
            <GuestOnlyRoute><SignIn /></GuestOnlyRoute>
          </Route>
          <Route path="/sign-up">
            <GuestOnlyRoute><SignUp /></GuestOnlyRoute>
          </Route>

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
  );
}

function App() {
  return (
    <ThemeProvider>
      <TeachModeProvider>
        <AuthProvider>
          <DemoProvider>
            <WouterRouter base={basePath}>
              <Routes />
            </WouterRouter>
          </DemoProvider>
        </AuthProvider>
      </TeachModeProvider>
    </ThemeProvider>
  );
}

export default App;
