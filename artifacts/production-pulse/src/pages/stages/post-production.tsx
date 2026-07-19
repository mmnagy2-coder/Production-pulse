import { useState, useRef } from "react";
import {
  useListCircledTakes,
  useListCuts,
  useCreateCut,
  useUpdateCut,
  useDeleteCut,
  useListCutComments,
  useAddCutComment,
  getListCutsQueryKey,
  getListCutCommentsQueryKey,
  getListCircledTakesQueryKey,
} from "@workspace/api-client-react";
import type { ReviewCut, CutComment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  MessageSquare,
  Loader2,
  Film,
  Link as LinkIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { TeachTip } from "@/components/teach-tip";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, cls: "bg-secondary text-foreground border-border" },
  changes_needed: { label: "Changes Needed", icon: AlertCircle, cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
  approved: { label: "Approved", icon: CheckCircle, cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" },
} as const;

function StatusBadge({ status }: { status: ReviewCut["status"] }) {
  const { label, icon: Icon, cls } = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-[3px] border ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── Pin marker ───────────────────────────────────────────────────────────────

function PinMarker({
  comment,
  onClick,
}: {
  comment: CutComment;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-md hover:scale-110 transition-transform z-10 select-none"
      style={{ left: `${comment.xPercent}%`, top: `${comment.yPercent}%` }}
      title={comment.text}
    >
      {comment.pinNumber}
    </button>
  );
}

// ─── Reusable URL edit form ───────────────────────────────────────────────────

function UrlEditForm({
  value,
  onChange,
  onSave,
  onCancel,
  isSaving,
  triggerLabel,
  open,
  onOpen,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  triggerLabel: string;
  open: boolean;
  onOpen: () => void;
}) {
  if (!open) {
    return (
      <button
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        onClick={onOpen}
      >
        <LinkIcon className="w-3 h-3" /> {triggerLabel}
      </button>
    );
  }
  return (
    <div className="flex gap-2 max-w-sm">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
        className="h-8 text-xs rounded-sm flex-1"
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
      />
      <Button size="sm" className="h-8 text-xs rounded-sm" onClick={onSave} disabled={isSaving}>
        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
      </Button>
      <Button size="sm" variant="ghost" className="h-8 text-xs rounded-sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

// ─── Image frame with pinning ─────────────────────────────────────────────────

function FrameImage({
  imageUrl,
  comments,
  onPin,
  selectedPinId,
  onSelectPin,
}: {
  imageUrl: string;
  comments: CutComment[];
  onPin: (x: number, y: number) => void;
  selectedPinId: number | null;
  onSelectPin: (id: number | null) => void;
}) {
  const imgRef = useRef<HTMLDivElement>(null);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onPin(x, y);
  }

  return (
    <div
      ref={imgRef}
      className="relative cursor-crosshair rounded-[3px] overflow-hidden bg-secondary border border-border"
      onClick={handleClick}
    >
      <img
        src={imageUrl}
        alt="Cut frame"
        className="w-full object-contain max-h-72 select-none pointer-events-none"
        draggable={false}
      />
      {comments.map((c) => (
        <PinMarker
          key={c.id}
          comment={c}
          onClick={(e?: React.MouseEvent) => {
            e?.stopPropagation?.();
            onSelectPin(selectedPinId === c.id ? null : c.id);
          }}
        />
      ))}
    </div>
  );
}

// ─── Cut detail panel ─────────────────────────────────────────────────────────

function CutDetail({
  cut,
  projectId,
  onDelete,
  onStatusChange,
}: {
  cut: ReviewCut;
  projectId: number;
  onDelete: () => void;
  onStatusChange: (status: ReviewCut["status"]) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);
  const [addingImage, setAddingImage] = useState(false);
  const [imageUrlDraft, setImageUrlDraft] = useState(cut.imageUrl ?? "");

  const { data: comments = [], isLoading: commentsLoading } = useListCutComments(
    projectId, cut.id, {
      query: {
        enabled: true,
        queryKey: getListCutCommentsQueryKey(projectId, cut.id),
      },
    }
  );

  const addComment = useAddCutComment();
  const updateCut = useUpdateCut();

  function handlePin(x: number, y: number) {
    setPendingPin({ x, y });
    setCommentText("");
  }

  function submitComment() {
    if (!pendingPin || !commentText.trim()) return;
    addComment.mutate(
      { projectId, id: cut.id, data: { text: commentText.trim(), xPercent: pendingPin.x, yPercent: pendingPin.y } },
      {
        onSuccess: () => {
          setPendingPin(null);
          setCommentText("");
          queryClient.invalidateQueries({ queryKey: getListCutCommentsQueryKey(projectId, cut.id) });
          queryClient.invalidateQueries({ queryKey: getListCutsQueryKey(projectId) });
        },
        onError: () => toast({ title: "Could not save comment", variant: "destructive" }),
      }
    );
  }

  function saveImageUrl() {
    updateCut.mutate(
      { projectId, id: cut.id, data: { imageUrl: imageUrlDraft || undefined } },
      {
        onSuccess: () => {
          setAddingImage(false);
          queryClient.invalidateQueries({ queryKey: getListCutsQueryKey(projectId) });
        },
        onError: () => toast({ title: "Could not update image", variant: "destructive" }),
      }
    );
  }

  const selectedPin = comments.find((c) => c.id === selectedPinId);

  return (
    <div className="flex flex-col gap-4">
      {/* Status row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <StatusBadge status={cut.status} />
        <div className="flex items-center gap-2">
          {(["pending", "changes_needed", "approved"] as ReviewCut["status"][]).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={`text-[10px] px-2 py-1 rounded-[3px] border font-medium transition-colors ${
                cut.status === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Image frame */}
      {cut.imageUrl ? (
        <div className="space-y-2">
          <TeachTip title="Frame Pinning">
            Click anywhere on the frame to drop a numbered pin and add a comment. Each pin links feedback to an exact moment in the edit.
          </TeachTip>
          <FrameImage
            imageUrl={cut.imageUrl}
            comments={comments}
            onPin={handlePin}
            selectedPinId={selectedPinId}
            onSelectPin={setSelectedPinId}
          />
          <UrlEditForm
            value={imageUrlDraft}
            onChange={setImageUrlDraft}
            onSave={saveImageUrl}
            onCancel={() => setAddingImage(false)}
            isSaving={updateCut.isPending}
            triggerLabel="Change frame URL"
            open={addingImage}
            onOpen={() => { setImageUrlDraft(cut.imageUrl ?? ""); setAddingImage(true); }}
          />
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-[3px] p-6 text-center">
          <Film className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground mb-3">No frame attached. Paste an image URL to enable click-to-pin comments.</p>
          <UrlEditForm
            value={imageUrlDraft}
            onChange={setImageUrlDraft}
            onSave={saveImageUrl}
            onCancel={() => setAddingImage(false)}
            isSaving={updateCut.isPending}
            triggerLabel="Paste frame URL"
            open={addingImage}
            onOpen={() => setAddingImage(true)}
          />
        </div>
      )}

      {/* Pending pin form */}
      {pendingPin && (
        <div className="bg-secondary/60 border border-border rounded-[3px] p-3 flex gap-2 items-center">
          <span className="text-xs text-muted-foreground shrink-0">Pin at ({pendingPin.x.toFixed(0)}%, {pendingPin.y.toFixed(0)}%):</span>
          <Input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Your comment…"
            className="h-7 text-xs rounded-sm flex-1"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") submitComment(); if (e.key === "Escape") setPendingPin(null); }}
          />
          <Button size="sm" className="h-7 text-xs rounded-sm bg-primary text-primary-foreground" onClick={submitComment} disabled={!commentText.trim() || addComment.isPending}>
            {addComment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
          </Button>
          <button onClick={() => setPendingPin(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Comments thread */}
      <div>
        <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Comments ({comments.length})
        </h4>
        {commentsLoading ? (
          <Skeleton className="h-16 rounded-sm" />
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            {cut.imageUrl ? "Click on the frame above to add a pinned comment." : "Add a frame to enable pinned comments."}
          </p>
        ) : (
          <div className="space-y-2">
            {comments.map((c) => (
              <div
                key={c.id}
                className={`flex gap-2.5 p-2.5 rounded-[3px] border text-sm cursor-pointer transition-colors ${
                  selectedPinId === c.id ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-border/80"
                }`}
                onClick={() => setSelectedPinId(selectedPinId === c.id ? null : c.id)}
              >
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {c.pinNumber}
                </span>
                <p className="text-sm flex-1">{c.text}</p>
              </div>
            ))}
          </div>
        )}
        {selectedPin && (
          <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded-[3px] text-xs text-muted-foreground">
            Pin #{selectedPin.pinNumber} at ({selectedPin.xPercent.toFixed(0)}%, {selectedPin.yPercent.toFixed(0)}%)
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PostProductionStage({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCutId, setSelectedCutId] = useState<number | null>(null);
  const [newCutTitle, setNewCutTitle] = useState("");

  const { data: circledTakes = [], isLoading: takesLoading } = useListCircledTakes(projectId, {
    query: { enabled: !!projectId, queryKey: getListCircledTakesQueryKey(projectId) },
  });

  const { data: cuts = [], isLoading: cutsLoading } = useListCuts(projectId, {
    query: { enabled: !!projectId, queryKey: getListCutsQueryKey(projectId) },
  });

  const createCut = useCreateCut();
  const updateCut = useUpdateCut();
  const deleteCut = useDeleteCut();

  const selectedCut = cuts.find((c) => c.id === selectedCutId) ?? null;

  function handleCreateCut(fromTitle?: string) {
    const title = (fromTitle ?? newCutTitle).trim();
    if (!title) return;
    createCut.mutate(
      { projectId, data: { title } },
      {
        onSuccess: (cut) => {
          setNewCutTitle("");
          setSelectedCutId(cut.id);
          queryClient.invalidateQueries({ queryKey: getListCutsQueryKey(projectId) });
        },
        onError: () => toast({ title: "Could not create cut", variant: "destructive" }),
      }
    );
  }

  function handleDeleteCut(cutId: number) {
    deleteCut.mutate(
      { projectId, id: cutId },
      {
        onSuccess: () => {
          if (selectedCutId === cutId) setSelectedCutId(null);
          queryClient.invalidateQueries({ queryKey: getListCutsQueryKey(projectId) });
        },
        onError: () => toast({ title: "Could not delete cut", variant: "destructive" }),
      }
    );
  }

  function handleStatusChange(cutId: number, status: ReviewCut["status"]) {
    updateCut.mutate(
      { projectId, id: cutId, data: { status } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCutsQueryKey(projectId) }),
        onError: () => toast({ title: "Could not update status", variant: "destructive" }),
      }
    );
  }

  const isLoading = cutsLoading || takesLoading;

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 bg-background">

      {/* Left: cuts list + circled takes */}
      <div className="w-full md:w-72 lg:w-80 shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-serif text-xl font-medium tracking-tight mb-1">Post-Production</h2>
          <TeachTip title="Why this stage?">
            Post-production is where you assemble the footage you shot. Circled takes from your shoot log feed directly into this stage, so the editor knows which take the director preferred.
          </TeachTip>
          <div className="flex gap-2 mt-3">
            <Input
              value={newCutTitle}
              onChange={(e) => setNewCutTitle(e.target.value)}
              placeholder="New cut title…"
              className="h-8 text-xs rounded-sm flex-1 border-border bg-background"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateCut(); }}
            />
            <Button
              size="sm"
              className="h-8 px-3 text-xs rounded-sm bg-primary text-primary-foreground hover:bg-[hsl(349_73%_34%)] shrink-0"
              onClick={() => handleCreateCut()}
              disabled={!newCutTitle.trim() || createCut.isPending}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-sm" />)}
            </div>
          ) : (
            <>
              {/* Existing cuts */}
              {cuts.length > 0 && (
                <div className="p-3 space-y-2">
                  {cuts.map((cut) => (
                    <button
                      key={cut.id}
                      onClick={() => setSelectedCutId(selectedCutId === cut.id ? null : cut.id)}
                      className={`w-full text-left p-3 rounded-[3px] border transition-colors ${
                        selectedCutId === cut.id
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-background hover:border-border/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-serif font-medium text-sm leading-tight line-clamp-1">{cut.title}</p>
                        <StatusBadge status={cut.status} />
                      </div>
                      {cut.commentCount != null && cut.commentCount > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                          <MessageSquare className="w-3 h-3" />
                          {cut.commentCount} comment{cut.commentCount !== 1 ? "s" : ""}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Circled takes divider */}
              {circledTakes.length > 0 && (
                <div className="px-3 pb-3">
                  <div className="flex items-center gap-2 my-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Circled Takes ({circledTakes.length})
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <TeachTip title="Circled Takes">
                    These are takes the director marked as keepers on set. They feed directly into post-production — no manual re-entry needed.
                  </TeachTip>
                  <div className="space-y-2">
                    {circledTakes.map((take) => (
                      <div key={take.id} className="p-2.5 border border-border rounded-[3px] bg-background">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="font-mono text-xs font-bold">
                              Sc.{take.sceneNumber} {take.shotLabel} T{take.takeNumber}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px] rounded-[2px] border-border"
                            onClick={() => handleCreateCut(`Sc.${take.sceneNumber} ${take.shotLabel} T${take.takeNumber}`)}
                          >
                            Create Cut
                          </Button>
                        </div>
                        {take.notes && (
                          <p className="text-[10px] text-muted-foreground mt-1 truncate">{take.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cuts.length === 0 && circledTakes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <Film className="w-10 h-10 text-muted-foreground mb-3 opacity-30" />
                  <h3 className="font-serif text-lg font-medium mb-1">No cuts yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Circle takes in the Production stage, or create a cut manually.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: cut detail */}
      <div className="flex-1 overflow-y-auto p-5 md:p-7">
        {selectedCut ? (
          <div className="max-w-2xl">
            <h1 className="font-serif text-2xl font-medium tracking-tight mb-1">{selectedCut.title}</h1>
            <p className="text-sm text-muted-foreground mb-5">
              Created {new Date(selectedCut.createdAt).toLocaleDateString()}
            </p>
            <CutDetail
              cut={selectedCut}
              projectId={projectId}
              onDelete={() => handleDeleteCut(selectedCut.id)}
              onStatusChange={(s) => handleStatusChange(selectedCut.id, s)}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <Film className="w-12 h-12 text-muted-foreground mb-4 opacity-30" />
            <h2 className="font-serif text-xl font-medium mb-2">Select a cut</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Choose a cut from the list to view and annotate the frame, or create a new one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
