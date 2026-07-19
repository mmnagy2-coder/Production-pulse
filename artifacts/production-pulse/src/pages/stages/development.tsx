import { useState, useRef, useEffect } from "react";
import { 
  useListScenes, 
  useCreateScene, 
  useUpdateScene, 
  useDeleteScene, 
  useRunBreakdown, 
  useAcceptBreakdown,
  getListScenesQueryKey,
  getGetProjectSummaryQueryKey
} from "@workspace/api-client-react";
import type { Scene, SceneInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Loader2, 
  Plus, 
  FileText, 
  Trash2, 
  X,
  Upload,
  AlertCircle,
  FileEdit,
  Clock,
  MapPin,
  Check
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

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

export default function DevelopmentStage({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [scriptText, setScriptText] = useState("");
  const [breakdownPreview, setBreakdownPreview] = useState<{ scenes: SceneInput[], aiAvailable: boolean } | null>(null);

  const { data: scenes, isLoading: isScenesLoading } = useListScenes(projectId, {
    query: { enabled: !!projectId, queryKey: getListScenesQueryKey(projectId) }
  });
  
  const [showAddScene, setShowAddScene] = useState(false);
  const [newSceneHeading, setNewSceneHeading] = useState("");
  const [newSceneLocation, setNewSceneLocation] = useState("");

  const runBreakdown = useRunBreakdown();
  const acceptBreakdown = useAcceptBreakdown();
  const createScene = useCreateScene();
  const updateScene = useUpdateScene();
  const deleteScene = useDeleteScene();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setScriptText(text);
      }
    };
    reader.readAsText(file);
  };

  const handleRunBreakdown = () => {
    if (!scriptText.trim()) {
      toast({ title: "No script text", description: "Please paste or upload a script first.", variant: "destructive" });
      return;
    }

    runBreakdown.mutate(
      { projectId, data: { scriptText } },
      {
        onSuccess: (result) => {
          setBreakdownPreview({ scenes: result.scenes, aiAvailable: result.aiAvailable });
          if (!result.aiAvailable) {
            toast({ 
              title: "AI Unavailable", 
              description: "Could not run automated breakdown. You can add scenes manually.",
              variant: "destructive"
            });
          }
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to run breakdown. Please try again.", variant: "destructive" });
        }
      }
    );
  };

  const handleAcceptBreakdown = () => {
    if (!breakdownPreview) return;

    acceptBreakdown.mutate(
      { projectId, data: { scenes: breakdownPreview.scenes } },
      {
        onSuccess: () => {
          setBreakdownPreview(null);
          setScriptText("");
          queryClient.invalidateQueries({ queryKey: getListScenesQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey(projectId) });
          toast({ title: "Breakdown saved", description: `${breakdownPreview.scenes.length} scenes added to project.` });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to save breakdown results.", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-background">
      
      {/* LEFT PANEL: Script Input & Breakdown */}
      <div className="w-full md:w-[400px] lg:w-[480px] border-r border-border bg-card flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-serif text-xl font-medium tracking-tight">Script Input</h2>
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-sm border-border hover:bg-secondary h-8 text-xs font-medium"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5 mr-2" />
            Upload .txt
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".txt" 
            onChange={handleFileUpload} 
          />
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto">
          {breakdownPreview ? (
            <div className="space-y-4">
              <div className="bg-secondary/50 p-4 rounded-sm border border-border">
                <h3 className="font-medium text-foreground mb-1">Breakdown Complete</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {breakdownPreview.scenes.length} scenes identified. Review them below or accept to save to your project.
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAcceptBreakdown} 
                    disabled={acceptBreakdown.isPending}
                    className="flex-1 rounded-sm bg-primary text-primary-foreground hover:bg-[hsl(349_73%_34%)] h-9"
                  >
                    {acceptBreakdown.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Accept & Save
                  </Button>
                  <Button 
                    onClick={() => setBreakdownPreview(null)} 
                    variant="outline"
                    className="rounded-sm border-border h-9"
                    disabled={acceptBreakdown.isPending}
                  >
                    Discard
                  </Button>
                </div>
              </div>

              {!breakdownPreview.aiAvailable && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>AI processing is currently unavailable. Scene extraction may be less accurate or incomplete.</p>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Preview ({breakdownPreview.scenes.length})</h4>
                {breakdownPreview.scenes.map((scene, idx) => (
                  <div key={idx} className="p-3 border border-border rounded-sm bg-background text-sm">
                    <div className="font-serif font-medium mb-1">
                      Scene {scene.sceneNumber}: {scene.heading}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{scene.summary}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <Label htmlFor="script-text" className="sr-only">Script Text</Label>
              <Textarea 
                id="script-text"
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Paste your screenplay text here...

Standard formatting works best:
INT. LOCATION - DAY
Action blocks...
CHARACTER
Dialogue..."
                className="flex-1 resize-none rounded-sm border-border bg-background font-mono text-sm leading-relaxed p-4 min-h-[300px] md:min-h-0 focus-visible:ring-primary focus-visible:border-primary"
              />
              <div className="pt-4 mt-auto">
                <Button 
                  onClick={handleRunBreakdown}
                  disabled={!scriptText.trim() || runBreakdown.isPending}
                  className="w-full bg-primary text-primary-foreground hover:bg-[hsl(349_73%_34%)] rounded-sm h-11 font-medium"
                >
                  {runBreakdown.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analysing script...
                    </>
                  ) : (
                    "Run Breakdown"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Scene List */}
      <div className="flex-1 flex flex-col min-w-0 bg-secondary/20">
        <div className="p-4 md:p-6 border-b border-border bg-background flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="font-serif text-2xl font-medium tracking-tight">Scenes</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {scenes?.length || 0} scenes in project
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-sm h-9 border-border bg-card"
            onClick={() => setShowAddScene((v) => !v)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Manually
          </Button>
        </div>

        {showAddScene && (
          <div className="p-4 border-b border-border bg-card flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Scene Heading</label>
              <Input
                placeholder="e.g. INT. KITCHEN - DAY"
                value={newSceneHeading}
                onChange={(e) => setNewSceneHeading(e.target.value)}
                className="rounded-sm h-8 text-sm border-border bg-background"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Location</label>
              <Input
                placeholder="e.g. KITCHEN"
                value={newSceneLocation}
                onChange={(e) => setNewSceneLocation(e.target.value)}
                className="rounded-sm h-8 text-sm border-border bg-background"
              />
            </div>
            <Button
              size="sm"
              className="rounded-sm h-8 bg-primary text-primary-foreground hover:bg-[hsl(349_73%_34%)] shrink-0"
              disabled={!newSceneHeading.trim() || createScene.isPending}
              onClick={() => {
                const nextNum = (scenes?.length ?? 0) + 1;
                const heading = newSceneHeading.trim().toUpperCase();
                const intExt = heading.startsWith("EXT") ? "EXT" : "INT";
                const dayNight = heading.endsWith("NIGHT") ? "NIGHT" : "DAY";
                createScene.mutate(
                  {
                    projectId,
                    data: {
                      sceneNumber: nextNum,
                      heading,
                      intExt,
                      dayNight,
                      location: newSceneLocation.trim().toUpperCase() || heading,
                      summary: "",
                      characters: [],
                      props: [],
                      costumes: [],
                    },
                  },
                  {
                    onSuccess: () => {
                      setNewSceneHeading("");
                      setNewSceneLocation("");
                      setShowAddScene(false);
                      queryClient.invalidateQueries({ queryKey: getListScenesQueryKey(projectId) });
                      queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey(projectId) });
                      toast({ title: "Scene added", description: `Scene ${nextNum} created.` });
                    },
                    onError: () => {
                      toast({ title: "Error", description: "Could not add scene.", variant: "destructive" });
                    },
                  },
                );
              }}
            >
              {createScene.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add Scene"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-sm h-8 text-muted-foreground shrink-0"
              onClick={() => { setShowAddScene(false); setNewSceneHeading(""); setNewSceneLocation(""); }}
            >
              Cancel
            </Button>
          </div>
        )}

        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          {isScenesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-sm" />
              ))}
            </div>
          ) : !scenes || scenes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto py-20">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-6">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-serif text-2xl font-medium text-foreground mb-2">No scenes yet</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Paste your script text in the left panel and run a breakdown to automatically extract scenes, characters, and elements.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {scenes.map((scene) => (
                <SceneCard 
                  key={scene.id} 
                  scene={scene} 
                  projectId={projectId} 
                  onUpdate={(id, data) => updateScene.mutate({ projectId, id, data }, {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: getListScenesQueryKey(projectId) });
                }
              })}
                  onDelete={(id) => deleteScene.mutate({ projectId, id }, {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getListScenesQueryKey(projectId) });
                      queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey(projectId) });
                    }
                  })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// SCENE CARD COMPONENT
function SceneCard({ 
  scene, 
  projectId, 
  onUpdate, 
  onDelete 
}: { 
  scene: Scene, 
  projectId: number,
  onUpdate: (id: number, data: any) => void,
  onDelete: (id: number) => void
}) {
  return (
    <Card className="rounded-sm border-border shadow-sm overflow-hidden group">
      <CardHeader className="bg-card pb-3 pt-4 px-4 sm:px-6 flex flex-row justify-between items-start gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="rounded-[2px] font-mono text-[10px] tracking-wider bg-secondary border border-border/50 text-foreground px-1.5 h-5">
              {scene.intExt}
            </Badge>
            <Badge variant="secondary" className="rounded-[2px] font-mono text-[10px] tracking-wider bg-secondary border border-border/50 text-foreground px-1.5 h-5">
              {scene.dayNight}
            </Badge>
            {scene.corrected && (
              <Badge variant="outline" className="rounded-[2px] text-[10px] text-primary border-primary/30 bg-primary/5 px-1.5 h-5 ml-2">
                <FileEdit className="w-3 h-3 mr-1 inline-block" /> Edited
              </Badge>
            )}
          </div>
          <CardTitle className="font-serif text-lg sm:text-xl font-medium leading-tight">
            <span className="text-muted-foreground mr-2 font-mono text-base">{scene.sceneNumber}.</span>
            {scene.heading}
          </CardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> {scene.location}
            </span>
            {scene.durationPages != null && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {scene.durationPages} pages
              </span>
            )}
          </div>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2 -mt-2 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-serif">Delete Scene {scene.sceneNumber}</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this scene? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => onDelete(scene.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>

      <CardContent className="px-4 sm:px-6 py-4 space-y-5 bg-background border-t border-border">
        <p className="text-sm text-foreground leading-relaxed">
          {scene.summary}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-border/50">
          <TagSection 
            title="Characters" 
            tags={scene.characters} 
            onAdd={(tag) => onUpdate(scene.id, { characters: [...scene.characters, tag] })}
            onRemove={(tag) => onUpdate(scene.id, { characters: scene.characters.filter((t: string) => t !== tag) })}
          />
          <TagSection 
            title="Props" 
            tags={scene.props} 
            onAdd={(tag) => onUpdate(scene.id, { props: [...scene.props, tag] })}
            onRemove={(tag) => onUpdate(scene.id, { props: scene.props.filter((t: string) => t !== tag) })}
          />
          <TagSection 
            title="Costumes" 
            tags={scene.costumes} 
            onAdd={(tag) => onUpdate(scene.id, { costumes: [...scene.costumes, tag] })}
            onRemove={(tag) => onUpdate(scene.id, { costumes: scene.costumes.filter((t: string) => t !== tag) })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// TAG SECTION COMPONENT
function TagSection({ 
  title, 
  tags, 
  onAdd, 
  onRemove 
}: { 
  title: string, 
  tags: string[], 
  onAdd: (tag: string) => void, 
  onRemove: (tag: string) => void 
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      onAdd(newTag.trim());
    }
    setNewTag("");
    setIsAdding(false);
  };

  return (
    <div>
      <h4 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center justify-between">
        {title}
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="text-primary hover:text-[hsl(349_73%_30%)] transition-colors p-1"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </h4>
      
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-[2px] border border-border/50">
            {tag}
            <button 
              onClick={() => onRemove(tag)}
              className="text-muted-foreground hover:text-destructive focus:outline-none"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {tags.length === 0 && !isAdding && (
          <span className="text-xs text-muted-foreground/60 italic">None</span>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="mt-2 flex items-center gap-1">
          <Input 
            value={newTag} 
            onChange={(e) => setNewTag(e.target.value)} 
            placeholder={`Add ${title.toLowerCase().slice(0, -1)}...`} 
            className="h-7 text-xs rounded-sm border-border focus-visible:ring-primary focus-visible:border-primary px-2"
            autoFocus
            onBlur={() => {
              if (!newTag.trim()) setIsAdding(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsAdding(false);
                setNewTag("");
              }
            }}
          />
          <Button type="submit" size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/10 rounded-sm">
            <Check className="w-3.5 h-3.5" />
          </Button>
        </form>
      )}
    </div>
  );
}
