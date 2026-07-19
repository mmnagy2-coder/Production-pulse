import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { Plus, Film, Loader2, Calendar, FileText, Clapperboard, FolderOpen, Trash2 } from "lucide-react";
import { useListProjects, useCreateProject, useDeleteProject, getListProjectsQueryKey, useGetProjectSummary, getGetProjectSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [logline, setLogline] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);
  const seededRef = useRef(false);

  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  // Seed demo project on first login (fires once when we confirm the user has no projects)
  useEffect(() => {
    if (isLoading || seededRef.current) return;
    if (!projects || projects.length > 0) return;

    seededRef.current = true;
    setIsSeeding(true);

    fetch("/api/seed-demo", { method: "POST", credentials: "include" })
      .then((r) => r.json())
      .then(() => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      })
      .catch(() => {
        // Non-fatal — user can still create projects manually
      })
      .finally(() => setIsSeeding(false));
  }, [isLoading, projects, queryClient]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createProject.mutate({
      data: {
        title,
        logline: logline || undefined
      }
    }, {
      onSuccess: (newProject) => {
        setIsCreateOpen(false);
        setTitle("");
        setLogline("");
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Project created", description: "Your new workspace is ready." });
        setLocation(`/projects/${newProject.id}/development`);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create project. Please try again.", variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteProject.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Project deleted", description: "The project has been removed." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete project.", variant: "destructive" });
      }
    });
  };

  const getStageDisplay = (stage: string) => {
    const stages: Record<string, string> = {
      'development': 'Development',
      'pre_production': 'Pre-Production',
      'production': 'Production',
      'post_production': 'Post-Production',
      'delivery': 'Delivery'
    };
    return stages[stage] || stage;
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-[hsl(349_73%_44%)] selection:text-white">
      <header className="px-6 md:px-8 py-4 flex items-center justify-between border-b border-border bg-card">
        <div className="flex items-center gap-3 text-foreground">
          <Film className="w-5 h-5 text-primary" />
          <span className="font-serif font-semibold text-lg tracking-tight">Production Pulse</span>
        </div>
        <div className="flex items-center gap-4">
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 px-6 md:px-8 py-10 max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="font-serif text-3xl font-medium text-foreground tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-1">Manage your active productions and workspaces.</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-[hsl(349_73%_34%)] rounded-sm h-10 px-4 text-sm font-medium shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-md">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl font-medium">Create Project</DialogTitle>
                <DialogDescription>
                  Start a new production workspace. You can edit these details later.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Working Title *</Label>
                  <Input 
                    id="title" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="e.g. The Grand Budapest Hotel" 
                    className="rounded-sm border-border focus-visible:ring-primary focus-visible:border-primary"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logline" className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Logline (Optional)</Label>
                  <Textarea 
                    id="logline" 
                    value={logline} 
                    onChange={(e) => setLogline(e.target.value)} 
                    placeholder="A brief summary of your project..." 
                    className="rounded-sm border-border focus-visible:ring-primary focus-visible:border-primary min-h-[80px] resize-none"
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button 
                    type="submit" 
                    disabled={!title.trim() || createProject.isPending}
                    className="bg-primary text-primary-foreground hover:bg-[hsl(349_73%_34%)] rounded-sm font-medium"
                  >
                    {createProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Workspace
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-border mb-4" />
            <p>Loading projects...</p>
          </div>
        ) : isSeeding ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="font-serif text-lg text-foreground mb-1">Setting up your workspace…</p>
            <p className="text-sm">Loading a demo project so you can explore every stage.</p>
          </div>
        ) : projects?.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-border rounded-md bg-card/50">
            <FolderOpen className="w-10 h-10 text-border mx-auto mb-4" />
            <h3 className="font-serif text-xl font-medium text-foreground mb-2">No projects yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              Create your first project to start running breakdowns, scheduling shoot days, and tracking takes.
            </p>
            <Button 
              onClick={() => setIsCreateOpen(true)}
              variant="outline" 
              className="rounded-sm border-border hover:bg-secondary text-foreground"
            >
              Create your first project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map((project) => (
              <Card key={project.id} className="rounded-md border-border shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                <CardHeader className="pb-3 flex-row justify-between items-start gap-4 space-y-0">
                  <div>
                    <CardTitle className="font-serif text-lg font-medium leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-2">
                      <Link href={`/projects/${project.id}/development`}>
                        {project.title}
                      </Link>
                    </CardTitle>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1.5 mt-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${project.currentStage === 'development' ? 'bg-primary' : 'bg-gray-400'}`} />
                      {getStageDisplay(project.currentStage)}
                    </div>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-serif">Delete Project</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{project.title}"? This action cannot be undone and will permanently remove all scenes, shoot days, and takes associated with this project.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDelete(project.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm"
                        >
                          {deleteProject.isPending && deleteProject.variables?.id === project.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardHeader>
                
                <CardContent className="pb-4 flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {project.logline || "No logline provided."}
                  </p>
                  
                  <ProjectStats projectId={project.id} />
                </CardContent>
                
                <CardFooter className="pt-0 pb-4">
                  <Link href={`/projects/${project.id}/development`} className="w-full">
                    <Button variant="outline" className="w-full rounded-sm border-border hover:bg-secondary hover:text-foreground font-medium text-sm">
                      Open Workspace
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// Separate component for stats to not block the main list render
function ProjectStats({ projectId }: { projectId: number }) {
  const { data: summary } = useGetProjectSummary(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectSummaryQueryKey(projectId) }
  });

  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 gap-2 mt-auto">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 p-2 rounded-sm border border-border/50">
        <FileText className="w-3.5 h-3.5" />
        <span className="font-medium text-foreground">{summary.sceneCount}</span> Scenes
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 p-2 rounded-sm border border-border/50">
        <Calendar className="w-3.5 h-3.5" />
        <span className="font-medium text-foreground">{summary.shootDayCount}</span> Shoot Days
      </div>
    </div>
  );
}
