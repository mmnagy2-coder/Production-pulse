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
  Menu
} from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import DevelopmentStage from "./stages/development";
import PreProductionStage from "./stages/pre-production";
import ProductionStage from "./stages/production";
import EvidenceLog from "./stages/evidence-log";

const STAGES = [
  { id: "development", label: "Development", icon: BookOpen },
  { id: "pre-production", label: "Pre-Production", icon: Calendar },
  { id: "production", label: "Production", icon: Clapperboard },
  { id: "post-production", label: "Post-Production", icon: Scissors },
  { id: "delivery", label: "Delivery", icon: PackageCheck },
];

export default function ProjectWorkspace({ id, stage }: { id: string, stage?: string }) {
  const projectId = parseInt(id, 10);
  const currentStage = stage || "development";
  const [, setLocation] = useLocation();

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !isNaN(projectId), queryKey: getGetProjectQueryKey(projectId) }
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
      case "delivery":
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            {(() => {
              const StageIcon = STAGES.find(s => s.id === currentStage)?.icon || Film;
              return <StageIcon className="w-12 h-12 mb-4 text-border" />;
            })()}
            <h2 className="font-serif text-2xl text-foreground mb-2">
              {STAGES.find(s => s.id === currentStage)?.label || "Stage"}
            </h2>
            <p className="max-w-md">
              {STAGES.find(s => s.id === currentStage)?.label} coming in the next update.
            </p>
          </div>
        );
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
              <s.icon className={`w-4 h-4 mr-3 ${currentStage === s.id ? "text-primary" : "text-muted-foreground"}`} />
              {s.label}
            </Button>
          </Link>
        ))}

        <div className="mt-8 mb-2 px-3">
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
            <Activity className={`w-4 h-4 mr-3 ${currentStage === "evidence-log" ? "text-primary" : "text-muted-foreground"}`} />
            Evidence Log
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-[hsl(349_73%_44%)] selection:text-white">
      <header className="px-4 py-3 flex items-center justify-between border-b border-border bg-card sticky top-0 z-20">
        <div className="flex items-center gap-2 text-foreground">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 -ml-2 text-muted-foreground hover:text-foreground">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r border-sidebar-border">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          
          <Link href="/dashboard" className="hidden sm:flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mr-4 transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Projects
          </Link>
          <div className="h-4 w-px bg-border mx-2 hidden sm:block" />
          
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" />
            <span className="font-serif font-medium tracking-tight">Production Pulse</span>
          </div>
        </div>
        <div className="flex items-center">
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
