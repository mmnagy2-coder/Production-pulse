import { useState, useCallback } from "react";
import {
  useListTakes,
  useLogTake,
  useUpdateTake,
  useListShootDays,
  getListTakesQueryKey,
  getListCircledTakesQueryKey,
} from "@workspace/api-client-react";
import type { Take } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Circle,
  CheckCircle,
  Loader2,
  Clapperboard,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ─── Clapperboard stripe header ───────────────────────────────────────────────

function ClapperStripes() {
  // Classic black-and-white diagonal stripe pattern
  return (
    <div
      className="h-10 w-full rounded-t-[4px] overflow-hidden"
      style={{
        background:
          "repeating-linear-gradient(45deg, #111 0px, #111 12px, #f0f0f0 12px, #f0f0f0 24px)",
      }}
    />
  );
}

// ─── Slate field — large editable cell ───────────────────────────────────────

function SlateField({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  maxLength = 20,
  wide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  wide?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-1 ${wide ? "flex-1" : ""}`}>
      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-yellow-400/60 select-none">
        {label}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className={`bg-transparent text-center text-white font-mono font-bold border-b-2 border-yellow-400/50 focus:border-yellow-400 outline-none transition-colors caret-yellow-400 selection:bg-yellow-400/30 leading-none ${
          wide ? "w-full text-3xl md:text-4xl py-2" : "w-20 text-3xl md:text-4xl py-2"
        }`}
        style={{ WebkitAppearance: "none" }}
      />
    </div>
  );
}

// ─── Take row in the running log ──────────────────────────────────────────────

function TakeRow({
  take,
  onToggleCircle,
  isToggling,
}: {
  take: Take;
  onToggleCircle: (take: Take) => void;
  isToggling: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 transition-colors ${
        take.circled ? "bg-yellow-400/8" : "hover:bg-white/3"
      }`}
    >
      {/* Circle indicator */}
      <button
        onClick={() => onToggleCircle(take)}
        disabled={isToggling}
        className={`shrink-0 transition-colors ${
          take.circled
            ? "text-yellow-400 hover:text-yellow-300"
            : "text-white/20 hover:text-yellow-400/50"
        }`}
        title={take.circled ? "Uncircle this take" : "Circle this take"}
      >
        {isToggling ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : take.circled ? (
          <CheckCircle className="w-5 h-5" />
        ) : (
          <Circle className="w-5 h-5" />
        )}
      </button>

      {/* Take ID */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-sm font-bold text-white">
            Sc.{take.sceneNumber} {take.shotLabel} T{take.takeNumber}
          </span>
          {take.circled && (
            <span className="text-[10px] uppercase tracking-wider font-bold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-[2px]">
              ✓ Circled
            </span>
          )}
        </div>
        {take.notes && (
          <p className="text-xs text-white/40 mt-0.5 truncate">{take.notes}</p>
        )}
      </div>

      {/* Time */}
      <span className="font-mono text-xs text-white/30 shrink-0 tabular-nums">
        {fmtTime(take.loggedAt)}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProductionStage({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Slate state
  const [sceneNumber, setSceneNumber] = useState("1");
  const [shotLabel, setShotLabel] = useState("A");
  const [takeNumber, setTakeNumber] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedShootDayId, setSelectedShootDayId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Data
  const { data: takes = [], isLoading: takesLoading } = useListTakes(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: getListTakesQueryKey(projectId),
      refetchInterval: 10_000, // refresh every 10 s on set
    },
  });

  const { data: shootDays = [] } = useListShootDays(projectId, {
    query: { enabled: !!projectId, queryKey: ["listShootDays", projectId] },
  });

  const logTake = useLogTake();
  const updateTake = useUpdateTake();

  const invalidateTakes = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListTakesQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getListCircledTakesQueryKey(projectId) });
  }, [queryClient, projectId]);

  // ── Log a take ───────────────────────────────────────────────────────────────
  function doLog(circled: boolean) {
    const sceneNum = parseInt(sceneNumber, 10);
    if (isNaN(sceneNum) || sceneNum < 1) {
      toast({ title: "Invalid scene number", variant: "destructive" });
      return;
    }
    if (!shotLabel.trim()) {
      toast({ title: "Shot label required", variant: "destructive" });
      return;
    }

    logTake.mutate(
      {
        projectId,
        data: {
          sceneNumber: sceneNum,
          shotLabel: shotLabel.trim().toUpperCase(),
          takeNumber,
          circled,
          notes: notes.trim() || undefined,
          shootDayId: selectedShootDayId ?? undefined,
        },
      },
      {
        onSuccess: (newTake) => {
          setTakeNumber((n) => n + 1);
          setNotes("");
          invalidateTakes();
          if (circled) {
            toast({
              title: `Take circled ✓`,
              description: `Sc.${newTake.sceneNumber} ${newTake.shotLabel} T${newTake.takeNumber} marked as keeper.`,
            });
          }
        },
        onError: () => {
          toast({ title: "Failed to log take", variant: "destructive" });
        },
      }
    );
  }

  // ── Toggle circled status ─────────────────────────────────────────────────────
  function handleToggleCircle(take: Take) {
    setTogglingId(take.id);
    updateTake.mutate(
      { projectId, id: take.id, data: { circled: !take.circled } },
      {
        onSuccess: () => {
          setTogglingId(null);
          invalidateTakes();
        },
        onError: () => {
          setTogglingId(null);
          toast({ title: "Could not update take", variant: "destructive" });
        },
      }
    );
  }

  const isLogging = logTake.isPending;

  return (
    // Force dark/clapperboard colours regardless of system theme
    <div className="flex flex-col h-full min-h-0" style={{ background: "#111" }}>

      {/* ── DIGITAL SLATE ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 max-w-lg mx-auto w-full">

        {/* Clapper top stripe */}
        <ClapperStripes />

        {/* Slate body */}
        <div
          className="rounded-b-[4px] p-5 border border-t-0 border-white/10"
          style={{ background: "#1a1a1a" }}
        >
          {/* Branding row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Clapperboard className="w-5 h-5 text-yellow-400" />
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-white/50">
                Production Pulse
              </span>
            </div>
            {/* Shoot day selector */}
            {shootDays.length > 0 && (
              <div className="relative">
                <select
                  value={selectedShootDayId ?? ""}
                  onChange={(e) =>
                    setSelectedShootDayId(e.target.value ? parseInt(e.target.value) : null)
                  }
                  className="appearance-none bg-white/5 border border-white/15 text-white text-xs font-mono rounded-[3px] px-3 py-1.5 pr-7 focus:outline-none focus:border-yellow-400/50 cursor-pointer"
                >
                  <option value="">No day</option>
                  {shootDays.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Main slate fields */}
          <div className="flex items-end gap-4 mb-5">
            <SlateField
              label="Scene"
              value={sceneNumber}
              onChange={setSceneNumber}
              type="text"
              inputMode="numeric"
              maxLength={5}
            />
            <SlateField
              label="Shot"
              value={shotLabel}
              onChange={(v) => setShotLabel(v.toUpperCase())}
              maxLength={3}
            />
            <SlateField
              label="Take"
              value={String(takeNumber)}
              onChange={(v) => {
                const n = parseInt(v, 10);
                if (!isNaN(n) && n > 0) setTakeNumber(n);
              }}
              type="text"
              inputMode="numeric"
              maxLength={3}
            />
          </div>

          {/* Notes */}
          <div className="mb-5">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-yellow-400/60 mb-1.5 block select-none">
              Notes
            </span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — MOS, camera issue, great performance…"
              maxLength={200}
              className="w-full bg-white/5 border border-white/15 rounded-[3px] px-3 py-2.5 text-sm text-white placeholder:text-white/20 font-mono focus:outline-none focus:border-yellow-400/50 transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  doLog(false);
                }
              }}
            />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => doLog(false)}
              disabled={isLogging}
              className="relative flex flex-col items-center justify-center rounded-[3px] py-4 px-3 font-mono font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 border border-white/20 text-white"
              style={{ background: "#2a2a2a" }}
            >
              {isLogging && !logTake.variables?.data?.circled ? (
                <Loader2 className="w-5 h-5 animate-spin mb-1" />
              ) : (
                <span className="text-2xl mb-1 leading-none">●</span>
              )}
              <span className="text-[11px]">Log Take</span>
            </button>

            <button
              onClick={() => doLog(true)}
              disabled={isLogging}
              className="relative flex flex-col items-center justify-center rounded-[3px] py-4 px-3 font-mono font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 border"
              style={{
                background: "rgba(251,191,36,0.12)",
                borderColor: "rgba(251,191,36,0.4)",
                color: "rgb(251,191,36)",
              }}
            >
              {isLogging && logTake.variables?.data?.circled ? (
                <Loader2 className="w-5 h-5 animate-spin mb-1" />
              ) : (
                <CheckCircle className="w-6 h-6 mb-1" />
              )}
              <span className="text-[11px]">Circle Take</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── RUNNING TAKE LOG ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col max-w-lg mx-auto w-full overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0"
          style={{ background: "#181818" }}
        >
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-white/40">
            Take Log
          </span>
          <div className="flex items-center gap-3 text-[10px] font-mono text-white/30">
            <span>{takes.length} total</span>
            <span className="text-yellow-400/60">
              {takes.filter((t) => t.circled).length} circled
            </span>
          </div>
        </div>

        {/* Takes list */}
        <div className="flex-1 overflow-y-auto" style={{ background: "#141414" }}>
          {takesLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 rounded-sm bg-white/5" />
              ))}
            </div>
          ) : takes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Clapperboard className="w-10 h-10 text-white/10 mb-3" />
              <p className="text-sm text-white/30 font-mono">
                No takes logged yet.
              </p>
              <p className="text-xs text-white/20 mt-1">
                Set your scene and shot, then press Log Take or Circle Take.
              </p>
            </div>
          ) : (
            takes.map((take) => (
              <TakeRow
                key={take.id}
                take={take}
                onToggleCircle={handleToggleCircle}
                isToggling={togglingId === take.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
