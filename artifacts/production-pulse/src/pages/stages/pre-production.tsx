import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  useListScenes,
  useListShootDays,
  useCreateShootDay,
  useDeleteShootDay,
  useSetDaySchedule,
  useGetCallSheet,
  useRequestAdReview,
  getListScenesQueryKey,
  getListShootDaysQueryKey,
  getGetCallSheetQueryKey,
  getGetScheduleWarningsQueryKey,
} from "@workspace/api-client-react";
import type {
  Scene,
  ShootDay,
  ScheduleWarning,
  CallSheet,
  AdReview,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Users,
  MapPin,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  CalendarDays,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TeachTip } from "@/components/teach-tip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ─── Scene card ──────────────────────────────────────────────────────────────

function DraggableSceneCard({ scene, compact }: { scene: Scene; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `scene-${scene.id}`,
    data: { scene },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-card border border-border rounded-[3px] px-3 py-2 cursor-grab active:cursor-grabbing select-none touch-none transition-shadow ${
        isDragging ? "shadow-lg ring-1 ring-primary/30" : "hover:shadow-sm"
      } ${compact ? "text-xs" : "text-sm"}`}
    >
      <div className="flex items-start gap-2">
        <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-[2px]">
          {scene.sceneNumber}.
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-serif font-medium leading-tight truncate ${compact ? "text-xs" : "text-sm"}`}>
            {scene.heading}
          </p>
          {!compact && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="rounded-[2px] text-[10px] px-1.5 h-4 font-mono border border-border/50">
                {scene.intExt}
              </Badge>
              <Badge variant="secondary" className="rounded-[2px] text-[10px] px-1.5 h-4 font-mono border border-border/50">
                {scene.dayNight}
              </Badge>
              {scene.durationPages != null && (
                <span className="text-[10px] text-muted-foreground">{scene.durationPages}p</span>
              )}
            </div>
          )}
          {!compact && scene.characters.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1 truncate">
              {scene.characters.slice(0, 3).join(", ")}
              {scene.characters.length > 3 && ` +${scene.characters.length - 3}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Ghost card shown during drag overlay
function SceneCardGhost({ scene }: { scene: Scene }) {
  return (
    <div className="bg-card border border-primary shadow-xl rounded-[3px] px-3 py-2 text-sm w-[220px] rotate-2">
      <p className="font-serif font-medium leading-tight truncate text-sm">{scene.heading}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        {scene.intExt} · {scene.durationPages ?? "?"}p
      </p>
    </div>
  );
}

// ─── Warning banners ──────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { icon: typeof AlertTriangle; cls: string }> = {
  error: { icon: AlertCircle, cls: "bg-destructive/10 border-destructive/30 text-destructive" },
  warning: { icon: AlertTriangle, cls: "bg-amber-50 border-amber-200 text-amber-800" },
  info: { icon: Info, cls: "bg-blue-50 border-blue-200 text-blue-800" },
};

function WarningBanner({ warning }: { warning: ScheduleWarning }) {
  const { icon: Icon, cls } = SEVERITY_STYLES[warning.severity] ?? SEVERITY_STYLES.info;
  return (
    <div className={`flex items-start gap-2 text-xs px-2.5 py-2 border rounded-[3px] ${cls}`}>
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <p>{warning.message}</p>
    </div>
  );
}

// ─── Shoot day column (droppable) ─────────────────────────────────────────────

interface ShootDayColumnProps {
  day: ShootDay;
  scenes: Scene[];
  onDelete: () => void;
  onSelect: () => void;
  isSelected: boolean;
  isSaving: boolean;
  onUnassign: (sceneId: number) => void;
}

function ShootDayColumn({
  day,
  scenes,
  onDelete,
  onSelect,
  isSelected,
  isSaving,
  onUnassign,
}: ShootDayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.id}`,
    data: { dayId: day.id },
  });

  const dayScenes = scenes.filter((s) => day.scheduledSceneIds.includes(s.id));
  const warnings = day.warnings ?? [];
  const totalPages = dayScenes.reduce((sum, s) => sum + (s.durationPages ?? 1), 0);

  return (
    <div
      className={`flex flex-col w-full md:w-72 lg:w-80 shrink-0 rounded-[3px] border transition-colors ${
        isSelected
          ? "border-primary/50 bg-primary/[0.03]"
          : isOver
            ? "border-primary/40 bg-primary/[0.02]"
            : "border-border bg-card"
      }`}
    >
      {/* Day header */}
      <div className="flex items-start justify-between p-3 border-b border-border">
        <button
          onClick={onSelect}
          className="text-left flex-1 min-w-0 group"
          aria-label={`Select ${day.label} for call sheet`}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">DAY {day.dayNumber}</span>
            {warnings.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title={`${warnings.length} warning(s)`} />
            )}
          </div>
          <h3 className="font-serif font-medium text-sm group-hover:text-primary transition-colors leading-tight mt-0.5">
            {day.label}
          </h3>
          {day.date && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{day.date}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
            <span>{dayScenes.length} scene{dayScenes.length !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{totalPages.toFixed(1)}p</span>
          </div>
        </button>
        <div className="flex items-center gap-1 ml-2">
          {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-sm"
            onClick={onDelete}
            title="Delete shoot day"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="px-3 pt-2 space-y-1.5">
          {warnings.map((w, i) => (
            <WarningBanner key={i} warning={w} />
          ))}
        </div>
      )}

      {/* Drop zone with scenes */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-3 space-y-2 min-h-[80px] transition-colors ${
          isOver ? "bg-primary/5 rounded-b-[3px]" : ""
        }`}
      >
        {dayScenes.length === 0 ? (
          <div className="flex items-center justify-center h-16 border border-dashed border-border rounded-[3px] text-[11px] text-muted-foreground">
            Drop scenes here
          </div>
        ) : (
          dayScenes.map((scene) => (
            <div key={scene.id} className="relative group/item">
              <DraggableSceneCard scene={scene} compact />
              <button
                onClick={() => onUnassign(scene.id)}
                className="absolute top-1 right-1 opacity-0 group-hover/item:opacity-100 transition-opacity w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive"
                title="Remove from day"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Call sheet link */}
      <div className="px-3 pb-3 pt-1">
        <Button
          variant="outline"
          size="sm"
          className={`w-full h-7 text-[11px] rounded-sm border-border ${isSelected ? "border-primary/50 text-primary" : ""}`}
          onClick={onSelect}
        >
          <FileText className="w-3.5 h-3.5 mr-1.5" />
          {isSelected ? "Showing Call Sheet" : "View Call Sheet"}
        </Button>
      </div>
    </div>
  );
}

// ─── Call sheet panel ─────────────────────────────────────────────────────────

function CallSheetPanel({
  projectId,
  dayId,
  onClose,
}: {
  projectId: number;
  dayId: number;
  onClose: () => void;
}) {
  const [showAdReview, setShowAdReview] = useState(false);
  const [adResult, setAdResult] = useState<AdReview | null>(null);
  const { toast } = useToast();

  const { data: callSheet, isLoading } = useGetCallSheet(projectId, dayId, {
    query: { enabled: true, queryKey: getGetCallSheetQueryKey(projectId, dayId) },
  });

  const adReviewMutation = useRequestAdReview();

  const handleRequestAdReview = () => {
    adReviewMutation.mutate(
      { projectId, id: dayId },
      {
        onSuccess: (result) => {
          setAdResult(result);
          setShowAdReview(true);
          if (!result.aiAvailable) {
            toast({
              title: "AI unavailable",
              description: "The AI mentor is not available right now. Try again later.",
              variant: "destructive",
            });
          }
        },
        onError: () => {
          toast({
            title: "Review failed",
            description: "Could not get AI feedback. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="border-t border-border bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-48 rounded-sm" />
        <Skeleton className="h-32 w-full rounded-sm" />
      </div>
    );
  }

  if (!callSheet) return null;

  return (
    <div className="border-t border-border bg-card">
      {/* Call sheet header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h2 className="font-serif text-xl font-medium tracking-tight">Call Sheet — {callSheet.label}</h2>
          </div>
          {callSheet.date && (
            <p className="text-sm text-muted-foreground mt-0.5 ml-8">{callSheet.date}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs rounded-sm border-border"
            onClick={handleRequestAdReview}
            disabled={adReviewMutation.isPending}
          >
            {adReviewMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            )}
            AD Review
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-sm text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* Scenes column */}
        <div className="p-5">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Scenes ({callSheet.scenes.length})
          </h3>
          <div className="space-y-3">
            {callSheet.scenes.map((scene) => (
              <div key={scene.id} className="text-sm">
                <div className="font-serif font-medium leading-tight">
                  <span className="font-mono text-xs text-muted-foreground mr-1">{scene.sceneNumber}.</span>
                  {scene.heading}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {scene.location}
                  </span>
                  {scene.durationPages != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {scene.durationPages}p
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
            <p><span className="font-medium text-foreground">Crew call:</span> {callSheet.crewCallTime}</p>
            {callSheet.generalCallTime && (
              <p className="mt-0.5"><span className="font-medium text-foreground">General call:</span> {callSheet.generalCallTime}</p>
            )}
          </div>
        </div>

        {/* Cast calls column */}
        <div className="p-5">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Cast Calls
          </h3>
          {callSheet.castCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cast assigned to scenes.</p>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pb-1 border-b border-border">
                <span className="col-span-1">Call</span>
                <span className="col-span-1">Makeup</span>
                <span className="col-span-1">On Set</span>
                <span className="col-span-1">Character</span>
              </div>
              {callSheet.castCalls.map((cast) => (
                <div key={cast.character} className="grid grid-cols-4 gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                  <span className="font-mono font-medium">{cast.callTime}</span>
                  <span className="font-mono text-muted-foreground">{cast.makeupTime}</span>
                  <span className="font-mono font-medium text-primary">{cast.onSetTime}</span>
                  <span className="truncate font-medium">{cast.character}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AD Review column */}
        <div className="p-5">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> AI Mentor Review
          </h3>

          {!adResult && !adReviewMutation.isPending && (
            <div className="text-center py-6 border border-dashed border-border rounded-[3px]">
              <Sparkles className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground mb-3">
                Get feedback from an AI First AD mentor on your schedule.
              </p>
              <Button
                size="sm"
                className="h-8 text-xs rounded-sm bg-primary text-primary-foreground hover:bg-[hsl(349_73%_34%)]"
                onClick={handleRequestAdReview}
              >
                Request Review
              </Button>
            </div>
          )}

          {adReviewMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Consulting AI mentor…</span>
            </div>
          )}

          {adResult && adResult.aiAvailable && (
            <div className="space-y-4">
              {adResult.verdict && (
                <div className="text-sm font-medium border-l-2 border-primary pl-3">
                  {adResult.verdict}
                </div>
              )}

              {adResult.issues.length > 0 && (
                <div className="space-y-2">
                  {adResult.issues.map((issue, i) => {
                    const { icon: Icon, cls } = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.info;
                    return (
                      <div key={i} className={`flex items-start gap-2 text-xs px-2.5 py-2 border rounded-[3px] ${cls}`}>
                        <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <p>{issue.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {adResult.coachingNote && (
                <div className="bg-secondary/50 border border-border p-3 rounded-[3px]">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Coaching Note</p>
                  <p className="text-sm leading-relaxed">{adResult.coachingNote}</p>
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-sm border-border w-full"
                onClick={handleRequestAdReview}
                disabled={adReviewMutation.isPending}
              >
                Refresh Review
              </Button>
            </div>
          )}

          {adResult && !adResult.aiAvailable && (
            <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-[3px]">
              AI mentor is currently unavailable.
              <br />
              <button
                className="text-primary hover:underline mt-1 block mx-auto"
                onClick={handleRequestAdReview}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Scene bank (droppable) ───────────────────────────────────────────────────

function SceneBank({
  scenes,
  locationFilter,
  onLocationFilter,
}: {
  scenes: Scene[];
  locationFilter: string;
  onLocationFilter: (v: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "scene-bank",
    data: { isBank: true },
  });

  const locations = Array.from(new Set(scenes.map((s) => s.location).filter(Boolean))).sort();

  const filtered = locationFilter && locationFilter !== "all"
    ? scenes.filter((s) => s.location === locationFilter)
    : scenes;

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="p-4 border-b border-border">
        <h2 className="font-serif text-lg font-medium tracking-tight mb-2">Scene Bank</h2>
        <p className="text-xs text-muted-foreground mb-3">
          {scenes.length} unscheduled scene{scenes.length !== 1 ? "s" : ""}
        </p>
        {locations.length > 1 && (
          <Select value={locationFilter} onValueChange={onLocationFilter}>
            <SelectTrigger className="h-8 text-xs rounded-sm border-border bg-background">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-3 space-y-2 transition-colors ${
          isOver ? "bg-primary/5" : ""
        }`}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground">
            <FileText className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">
              {scenes.length === 0
                ? "Run a script breakdown first to populate scenes."
                : "All scenes are scheduled."}
            </p>
          </div>
        ) : (
          filtered.map((scene) => (
            <DraggableSceneCard key={scene.id} scene={scene} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PreProductionStage({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [locationFilter, setLocationFilter] = useState("all");
  const [newDayLabel, setNewDayLabel] = useState("");
  const [addingDay, setAddingDay] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [savingDayId, setSavingDayId] = useState<number | null>(null);
  const [activeDragScene, setActiveDragScene] = useState<Scene | null>(null);

  const { data: allScenes = [], isLoading: scenesLoading } = useListScenes(projectId, {
    query: { enabled: !!projectId, queryKey: getListScenesQueryKey(projectId) },
  });

  const { data: shootDays = [], isLoading: daysLoading } = useListShootDays(projectId, {
    query: { enabled: !!projectId, queryKey: getListShootDaysQueryKey(projectId) },
  });

  const createShootDay = useCreateShootDay();
  const deleteShootDay = useDeleteShootDay();
  const setDaySchedule = useSetDaySchedule();

  // Scenes that belong to no day
  const unscheduledScenes = allScenes.filter(
    (s) => !shootDays.some((d) => d.scheduledSceneIds.includes(s.id))
  );

  const invalidateSchedule = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListScenesQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getListShootDaysQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetScheduleWarningsQueryKey(projectId) });
    if (selectedDayId) {
      queryClient.invalidateQueries({ queryKey: getGetCallSheetQueryKey(projectId, selectedDayId) });
    }
  }, [queryClient, projectId, selectedDayId]);

  // ── DnD sensors ─────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const scene = event.active.data.current?.scene as Scene | undefined;
    if (scene) setActiveDragScene(scene);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragScene(null);
    const { active, over } = event;
    if (!over) return;

    const scene = active.data.current?.scene as Scene | undefined;
    if (!scene) return;

    const overId = over.id as string;

    // Identify source (which day does the scene currently belong to?)
    const sourceDayId = shootDays.find((d) => d.scheduledSceneIds.includes(scene.id))?.id ?? null;

    if (overId === "scene-bank") {
      // Drop back to bank → remove from source day
      if (sourceDayId === null) return; // already in bank
      const sourceDay = shootDays.find((d) => d.id === sourceDayId)!;
      const newIds = sourceDay.scheduledSceneIds.filter((id) => id !== scene.id);
      persistSchedule(sourceDayId, newIds);
    } else if (overId.startsWith("day-")) {
      const targetDayId = parseInt(overId.replace("day-", ""), 10);

      if (sourceDayId === targetDayId) return; // same day, no-op

      // Remove from source day (if any)
      if (sourceDayId !== null) {
        const sourceDay = shootDays.find((d) => d.id === sourceDayId)!;
        const newSourceIds = sourceDay.scheduledSceneIds.filter((id) => id !== scene.id);
        persistSchedule(sourceDayId, newSourceIds);
      }

      // Add to target day
      const targetDay = shootDays.find((d) => d.id === targetDayId)!;
      const newTargetIds = [...targetDay.scheduledSceneIds, scene.id];
      persistSchedule(targetDayId, newTargetIds);
    }
  }

  function persistSchedule(dayId: number, sceneIds: number[]) {
    setSavingDayId(dayId);
    setDaySchedule.mutate(
      { projectId, id: dayId, data: { sceneIds } },
      {
        onSuccess: () => {
          setSavingDayId(null);
          invalidateSchedule();
        },
        onError: () => {
          setSavingDayId(null);
          toast({ title: "Error", description: "Could not save schedule.", variant: "destructive" });
        },
      }
    );
  }

  function handleUnassign(sceneId: number) {
    const day = shootDays.find((d) => d.scheduledSceneIds.includes(sceneId));
    if (!day) return;
    const newIds = day.scheduledSceneIds.filter((id) => id !== sceneId);
    persistSchedule(day.id, newIds);
  }

  function handleMobileAssign(sceneId: number, dayId: number | "bank") {
    if (dayId === "bank") {
      handleUnassign(sceneId);
      return;
    }
    const sourceDayId = shootDays.find((d) => d.scheduledSceneIds.includes(sceneId))?.id ?? null;
    if (sourceDayId === dayId) return;
    if (sourceDayId !== null) {
      const sourceDay = shootDays.find((d) => d.id === sourceDayId)!;
      persistSchedule(sourceDayId, sourceDay.scheduledSceneIds.filter((id) => id !== sceneId));
    }
    const targetDay = shootDays.find((d) => d.id === dayId)!;
    persistSchedule(dayId, [...targetDay.scheduledSceneIds, sceneId]);
  }

  function handleCreateDay() {
    const label = newDayLabel.trim();
    if (!label) {
      const autoLabel = `Day ${shootDays.length + 1}`;
      createShootDay.mutate(
        { projectId, data: { label: autoLabel } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListShootDaysQueryKey(projectId) });
          },
        }
      );
    } else {
      createShootDay.mutate(
        { projectId, data: { label } },
        {
          onSuccess: () => {
            setNewDayLabel("");
            setAddingDay(false);
            queryClient.invalidateQueries({ queryKey: getListShootDaysQueryKey(projectId) });
          },
          onError: () => {
            toast({ title: "Error", description: "Could not create shoot day.", variant: "destructive" });
          },
        }
      );
    }
    setAddingDay(false);
    setNewDayLabel("");
  }

  function handleDeleteDay(dayId: number) {
    deleteShootDay.mutate(
      { projectId, id: dayId },
      {
        onSuccess: () => {
          if (selectedDayId === dayId) setSelectedDayId(null);
          queryClient.invalidateQueries({ queryKey: getListShootDaysQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getListScenesQueryKey(projectId) });
        },
        onError: () => {
          toast({ title: "Error", description: "Could not delete shoot day.", variant: "destructive" });
        },
      }
    );
  }

  const isLoading = scenesLoading || daysLoading;

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-64 rounded-sm" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-sm" />
          <Skeleton className="h-64 rounded-sm" />
          <Skeleton className="h-64 rounded-sm" />
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full min-h-0">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
          <div>
            <h1 className="font-serif text-xl font-medium tracking-tight">Pre-Production</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Schedule {allScenes.length} scenes across shoot days. Drag scenes from the bank onto days.
            </p>
            <TeachTip title="Why shoot out of order?">
              Films almost never shoot in story order. Scenes are grouped by location, cast availability, and lighting conditions to keep costs down. The scene bank on the left holds all unscheduled scenes — drag them onto shoot days on the right.
            </TeachTip>
          </div>
          <div className="flex items-center gap-2">
            {addingDay ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newDayLabel}
                  onChange={(e) => setNewDayLabel(e.target.value)}
                  placeholder={`Day ${shootDays.length + 1}`}
                  className="h-8 text-xs rounded-sm border-border w-36"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateDay(); if (e.key === "Escape") setAddingDay(false); }}
                  autoFocus
                />
                <Button size="sm" className="h-8 text-xs rounded-sm bg-primary text-primary-foreground hover:bg-[hsl(349_73%_34%)]" onClick={handleCreateDay} disabled={createShootDay.isPending}>
                  {createShootDay.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs rounded-sm" onClick={() => setAddingDay(false)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" className="h-8 text-xs rounded-sm bg-primary text-primary-foreground hover:bg-[hsl(349_73%_34%)]" onClick={() => setAddingDay(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Shoot Day
              </Button>
            )}
          </div>
        </div>

        {/* Scheduler board */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Scene bank — desktop left panel */}
          <div className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 overflow-y-auto">
            <SceneBank
              scenes={unscheduledScenes}
              locationFilter={locationFilter}
              onLocationFilter={setLocationFilter}
            />
          </div>

          {/* Shoot day columns */}
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <div className="flex gap-4 p-4 h-full">
              {shootDays.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground py-20">
                  <CalendarDays className="w-10 h-10 mb-3 opacity-30" />
                  <h3 className="font-serif text-lg font-medium text-foreground mb-1">No shoot days yet</h3>
                  <p className="text-sm max-w-xs">
                    Click "Add Shoot Day" to start building your schedule. Then drag scenes from the bank onto each day.
                  </p>
                </div>
              ) : (
                shootDays.map((day) => (
                  <ShootDayColumn
                    key={day.id}
                    day={day}
                    scenes={allScenes}
                    onDelete={() => handleDeleteDay(day.id)}
                    onSelect={() => setSelectedDayId(selectedDayId === day.id ? null : day.id)}
                    isSelected={selectedDayId === day.id}
                    isSaving={savingDayId === day.id}
                    onUnassign={handleUnassign}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Mobile: scene list with assign controls */}
        <div className="md:hidden border-t border-border bg-card">
          <details className="group">
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
              <span className="font-serif text-sm font-medium">Scene Bank ({unscheduledScenes.length} unscheduled)</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground group-open:hidden" />
              <ChevronUp className="w-4 h-4 text-muted-foreground hidden group-open:block" />
            </summary>
            <div className="px-4 pb-4 space-y-2 max-h-64 overflow-y-auto">
              {unscheduledScenes.map((scene) => (
                <div key={scene.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-serif font-medium truncate leading-tight">
                      <span className="font-mono text-xs text-muted-foreground mr-1">{scene.sceneNumber}.</span>
                      {scene.heading}
                    </p>
                  </div>
                  {shootDays.length > 0 && (
                    <Select onValueChange={(v) => handleMobileAssign(scene.id, v === "bank" ? "bank" : parseInt(v))}>
                      <SelectTrigger className="h-7 text-xs w-28 rounded-sm border-border shrink-0">
                        <SelectValue placeholder="Assign…" />
                      </SelectTrigger>
                      <SelectContent>
                        {shootDays.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* Call sheet panel */}
        {selectedDayId && (
          <CallSheetPanel
            projectId={projectId}
            dayId={selectedDayId}
            onClose={() => setSelectedDayId(null)}
          />
        )}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDragScene && <SceneCardGhost scene={activeDragScene} />}
      </DragOverlay>
    </DndContext>
  );
}
