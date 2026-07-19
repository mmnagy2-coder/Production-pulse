import { Link } from "wouter";
import {
  useListProjects,
  useGetProjectSummary,
  getListProjectsQueryKey,
} from "@workspace/api-client-react";
import {
  BookOpen,
  Calendar,
  Clapperboard,
  Scissors,
  PackageCheck,
  ChevronLeft,
  Film,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";

// Stage columns config
const STAGES = [
  { id: "development", label: "Development", icon: BookOpen, color: "border-blue-300 dark:border-blue-700" },
  { id: "pre-production", label: "Pre-Production", icon: Calendar, color: "border-amber-300 dark:border-amber-700" },
  { id: "production", label: "Production", icon: Clapperboard, color: "border-primary/60" },
  { id: "post-production", label: "Post-Production", icon: Scissors, color: "border-violet-300 dark:border-violet-700" },
  { id: "delivery", label: "Delivery", icon: PackageCheck, color: "border-emerald-300 dark:border-emerald-700" },
];

function ProjectCard({ project }: { project: { id: number; title: string; genre?: string | null; currentStage: string } }) {
  const { data: summary } = useGetProjectSummary(project.id, {
    query: { queryKey: ["projectSummary", project.id] },
  });

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-card border border-border rounded-[3px] p-3 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group">
        <h3 className="font-serif font-medium text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {project.title}
        </h3>
        {project.genre && (
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{project.genre}</p>
        )}
        {summary && (
          <div className="mt-2 pt-2 border-t border-border/60 flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
            <span>{summary.sceneCount ?? 0} sc.</span>
            <span>{summary.shootDayCount ?? 0} days</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function ProjectBoard() {
  const { data: projects = [], isLoading } = useListProjects({
    query: { queryKey: getListProjectsQueryKey() },
  });

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="px-4 py-3 flex items-center justify-between border-b border-border bg-card sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-sm">
              <ChevronLeft className="w-4 h-4 mr-1" /> Dashboard
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" />
            <span className="font-serif font-medium tracking-tight">Board View</span>
          </div>
        </div>
        <UserMenu />
      </header>

      <div className="flex-1 overflow-x-auto p-5">
        {isLoading ? (
          <div className="flex gap-4">
            {STAGES.map((s) => (
              <Skeleton key={s.id} className="w-52 h-64 rounded-sm shrink-0" />
            ))}
          </div>
        ) : (
          <div className="flex gap-4 min-h-[500px]">
            {STAGES.map((stage) => {
              const stageProjects = projects.filter((p) => p.currentStage === stage.id || (stage.id === "development" && !p.currentStage));
              const Icon = stage.icon;
              return (
                <div key={stage.id} className={`flex flex-col w-52 shrink-0 rounded-[3px] border-t-2 ${stage.color} bg-secondary/20 border border-border`}>
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium text-xs">{stage.label}</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground">{stageProjects.length}</span>
                  </div>
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                    {stageProjects.length === 0 ? (
                      <div className="h-16 flex items-center justify-center border border-dashed border-border/60 rounded-[3px] text-[10px] text-muted-foreground">
                        No projects
                      </div>
                    ) : (
                      stageProjects.map((p) => <ProjectCard key={p.id} project={{ ...p, currentStage: p.currentStage ?? "" }} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
