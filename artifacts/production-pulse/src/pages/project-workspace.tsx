import { Link, useLocation } from "wouter";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import {
  BookOpen,
  Film,
  Calendar,
  Clapperboard,
  Scissors,
  PackageCheck,
  Activity,
  ChevronLeft,
  Menu,
  Sun,
  Moon,
  GraduationCap,
  LayoutGrid,
  Clock,
  LogOut,
} from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/contexts/theme";
import { useTeachMode } from "@/contexts/teach-mode";
import { useDemo } from "@/contexts/demo";

import DevelopmentStage from "./stages/development";
import PreProductionStage from "./stages/pre-production";
import ProductionStage from "./stages/production";
import PostProductionStage from "./stages/post-production";
import DeliveryStage from "./stages/delivery";
import EvidenceLog from "./stages/evidence-log";

const STAGES = [
  { id: "development", label: "Development", icon: BookOpen },
  { id: "pre-production", label: "Pre-Production", icon: Calendar },
  { id: "production", label: "Production", icon: Clapperboard },
  { id: "post-production", label: "Post-Production", icon: Scissors },
  { id: "delivery", label: "Delivery", icon: PackageCheck },
];

export default function ProjectWorkspace({ id, stage }: { id: string; stage?: string }) {
  const projectId = parseInt(id, 10);
  const currentStage = stage || "development";
  const { theme, toggleTheme } = useTheme();
  const { teachMode, toggleTeachMode } = useTeachMode();
  const { isDemo, exitDemo } = useDemo();

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !isNaN(projectId), queryKey: getGetProjectQueryKey(projectId) },
  });

  const renderStageContent = () => {
    switch (currentStage) {
      case "development":
        return <DevelopmentStage projectId={projectId} />;
      case "evidence-log":
        return <EvidenceLog projectId={projectId} />;
      case "pre-production":
        return <PreProductionStage projectId={projectId} />;
      case "production":
        return <ProductionStage projectId={projectId} />;
      case "post-production":
        return <PostProductionStage projectId={projectId} />;
      case "delivery":
        return <DeliveryStage projectId={projectId} />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-muted-foreground">Stage not found.</p>
          </div>
        );
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-4 border-b border-sidebar-border/50">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4 rounded-sm" />
            <Skeleton className="h-3 w-1/2 rounded-sm" />
          </div>
        ) : (
          <div>
            <h2 className="font-serif font-medium text-sidebar-foreground line-clamp-1">
              {project?.title || "Untitled Project"}
            </h2>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-1">
              {project?.genre || "Production"}
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        <div className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-2 px-3">
          Stages
        </div>
        {STAGES.map((s) => (
          <Link key={s.id} href={`/projects/${projectId}/${s.id}`}>
            <Button
              variant="ghost"
              className={`w-full justify-start rounded-sm text-sm ${
                currentStage === s.id
                  ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <s.icon
                className={`w-4 h-4 mr-3 ${currentStage === s.id ? "text-primary" : "text-muted-foreground"}`}
              />
              {s.label}
            </Button>
          </Link>
        ))}

        <div className="mt-6 mb-2 px-3">
          <div className="h-px bg-sidebar-border w-full" />
        </div>

        <Link href={`/projects/${projectId}/evidence-log`}>
          <Button
            variant="ghost"
            className={`w-full justify-start rounded-sm text-sm ${
              currentStage === "evidence-log"
                ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <Activity
              className={`w-4 h-4 mr-3 ${currentStage === "evidence-log" ? "text-primary" : "text-muted-foreground"}`}
            />
            Evidence Log
          </Button>
        </Link>

        <div className="mt-6 mb-2 px-3">
          <div className="h-px bg-sidebar-border w-full" />
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-3 mb-1">
            Project Views
          </p>
        </div>

        <Link href="/board">
          <Button
            variant="ghost"
            className="w-full justify-start rounded-sm text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LayoutGrid className="w-4 h-4 mr-3 text-muted-foreground" />
            Board View
          </Button>
        </Link>

        <Link href={`/projects/${projectId}/timeline`}>
          <Button
            variant="ghost"
            className="w-full justify-start rounded-sm text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Clock className="w-4 h-4 mr-3 text-muted-foreground" />
            Timeline
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-[hsl(349_73%_44%)] selection:text-white">
      {isDemo && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <span className="font-medium">Demo Mode</span>
            <span className="text-amber-700 dark:text-amber-300/80 hidden sm:inline">— Try every feature without an account.</span>
          </div>
          <button
            onClick={exitDemo}
            className="flex items-center gap-1.5 text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 font-medium"
          >
            <LogOut className="w-4 h-4" /> Exit Demo
          </button>
        </div>
      )}
      <header className="px-4 py-3 flex items-center justify-between border-b border-border bg-card sticky top-0 z-20">
        <div className="flex items-center gap-2 text-foreground">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8 -ml-2 text-muted-foreground hover:text-foreground"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r border-sidebar-border">
              <SidebarContent />
            </SheetContent>
          </Sheet>

          <Link
            href="/dashboard"
            className="hidden sm:flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mr-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Projects
          </Link>
          <div className="h-4 w-px bg-border mx-2 hidden sm:block" />

          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" />
            <span className="font-serif font-medium tracking-tight">Production Pulse</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Teach Mode toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTeachMode}
            className={`h-8 gap-1.5 text-xs rounded-sm ${
              teachMode
                ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={teachMode ? "Teach Mode ON — click to disable" : "Enable Teach Mode"}
          >
            <GraduationCap className="w-4 h-4" />
            <span className="hidden sm:inline">{teachMode ? "Teach" : "Teach"}</span>
          </Button>

          {/* Dark mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-sm text-muted-foreground hover:text-foreground"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          <UserMenu />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 border-r border-sidebar-border flex-shrink-0 bg-sidebar overflow-y-auto">
          <SidebarContent />
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-background">
          {renderStageContent()}
        </main>
      </div>
    </div>
  );
}
