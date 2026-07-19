import { useState } from "react";
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
  useListDeliverables,
  useCreateDeliverable,
  useUpdateDeliverable,
  useDeleteDeliverable,
  getListDeliverablesQueryKey,
} from "@workspace/api-client-react";
import type { Deliverable, DeliverableStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, PackageCheck, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { TeachTip } from "@/components/teach-tip";

// ─── Column config ────────────────────────────────────────────────────────────

const COLUMNS: { id: DeliverableStatus; label: string; color: string }[] = [
  { id: "not_started", label: "Not Started", color: "border-border" },
  { id: "in_progress", label: "In Progress", color: "border-blue-300 dark:border-blue-700" },
  { id: "in_review", label: "In Review", color: "border-amber-300 dark:border-amber-700" },
  { id: "delivered", label: "Delivered", color: "border-emerald-300 dark:border-emerald-700" },
];

// ─── Draggable card ───────────────────────────────────────────────────────────

function DeliverableCard({
  deliverable,
  onDelete,
}: {
  deliverable: Deliverable;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `del-${deliverable.id}`,
    data: { deliverable },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-card border border-border rounded-[3px] p-3 cursor-grab active:cursor-grabbing select-none touch-none ${
        isDragging ? "shadow-lg" : "hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-2">
        <button {...listeners} {...attributes} className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0">
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-serif font-medium text-sm leading-tight">{deliverable.title}</p>
          {deliverable.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{deliverable.description}</p>
          )}
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function CardGhost({ deliverable }: { deliverable: Deliverable }) {
  return (
    <div className="bg-card border border-primary shadow-lg rounded-[3px] p-3 w-52 rotate-1 text-sm font-serif font-medium">
      {deliverable.title}
    </div>
  );
}

// ─── Droppable column ─────────────────────────────────────────────────────────

function KanbanColumn({
  columnId,
  label,
  color,
  deliverables,
  onDelete,
  onAddDeliverable,
}: {
  columnId: DeliverableStatus;
  label: string;
  color: string;
  deliverables: Deliverable[];
  onDelete: (id: number) => void;
  onAddDeliverable: (title: string, status: DeliverableStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId, data: { columnId } });
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  function submitAdd() {
    const t = newTitle.trim();
    if (!t) return;
    onAddDeliverable(t, columnId);
    setNewTitle("");
    setAdding(false);
  }

  return (
    <div className={`flex flex-col w-64 shrink-0 rounded-[3px] border-t-2 ${color} bg-secondary/30 border border-border`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="font-medium text-sm">{label}</span>
        <span className="text-[11px] text-muted-foreground font-mono">{deliverables.length}</span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 min-h-[80px] transition-colors ${isOver ? "bg-primary/5" : ""}`}
      >
        {deliverables.map((d) => (
          <DeliverableCard key={d.id} deliverable={d} onDelete={() => onDelete(d.id)} />
        ))}

        {deliverables.length === 0 && !adding && (
          <div className="flex items-center justify-center h-16 border border-dashed border-border/60 rounded-[3px] text-[11px] text-muted-foreground">
            Drop here
          </div>
        )}
      </div>

      {/* Add form */}
      <div className="p-2 border-t border-border">
        {adding ? (
          <div className="space-y-1.5">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Deliverable title…"
              className="h-7 text-xs rounded-[3px] border-border bg-background"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") setAdding(false); }}
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-[11px] rounded-[3px] flex-1 bg-primary text-primary-foreground hover:bg-[hsl(349_73%_34%)]" onClick={submitAdd}>
                Add
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-[11px] rounded-[3px]" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full text-[11px] text-muted-foreground rounded-[3px] justify-start"
            onClick={() => setAdding(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add deliverable
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DeliveryStage({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeDeliverable, setActiveDeliverable] = useState<Deliverable | null>(null);

  const { data: deliverables = [], isLoading } = useListDeliverables(projectId, {
    query: { enabled: !!projectId, queryKey: getListDeliverablesQueryKey(projectId) },
  });

  const createDeliverable = useCreateDeliverable();
  const updateDeliverable = useUpdateDeliverable();
  const deleteDeliverable = useDeleteDeliverable();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListDeliverablesQueryKey(projectId) });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart(event: DragStartEvent) {
    const d = event.active.data.current?.deliverable as Deliverable | undefined;
    if (d) setActiveDeliverable(d);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDeliverable(null);
    const { active, over } = event;
    if (!over) return;
    const deliverable = active.data.current?.deliverable as Deliverable | undefined;
    if (!deliverable) return;
    const newStatus = over.id as DeliverableStatus;
    if (newStatus === deliverable.status) return;
    updateDeliverable.mutate(
      { projectId, id: deliverable.id, data: { status: newStatus } },
      { onSuccess: invalidate, onError: () => toast({ title: "Could not update", variant: "destructive" }) }
    );
  }

  function handleAdd(title: string, status: DeliverableStatus) {
    createDeliverable.mutate(
      { projectId, data: { title, status } },
      { onSuccess: invalidate, onError: () => toast({ title: "Could not create deliverable", variant: "destructive" }) }
    );
  }

  function handleDelete(id: number) {
    deleteDeliverable.mutate(
      { projectId, id },
      { onSuccess: invalidate, onError: () => toast({ title: "Could not delete", variant: "destructive" }) }
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 w-64 rounded-sm shrink-0" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-5 py-3 border-b border-border bg-card shrink-0">
        <h1 className="font-serif text-xl font-medium tracking-tight">Delivery</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Track deliverables from inception to delivery. Drag cards between columns.</p>
        <TeachTip title="Why a Kanban board?">
          Delivery involves many moving parts: trailers, press kits, final masters, festival submissions. A Kanban board makes it easy to see what's done and what's stuck at a glance.
        </TeachTip>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto p-5">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full min-h-[400px]">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                columnId={col.id}
                label={col.label}
                color={col.color}
                deliverables={deliverables.filter((d) => d.status === col.id)}
                onDelete={handleDelete}
                onAddDeliverable={handleAdd}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDeliverable && <CardGhost deliverable={activeDeliverable} />}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
