import { Link, useLocation } from "wouter";
import { useGetProject, useListShootDays } from "@workspace/api-client-react";
import { ChevronLeft, Film, CalendarDays, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ProjectTimeline({ id }: { id: string }) {
  const projectId = parseInt(id, 10);

  const { data: project, isLoading: projectLoading } = useGetProject(projectId, {
    query: { enabled: !isNaN(projectId), queryKey: ["project", projectId] },
  });

  const { data: shootDays = [], isLoading: daysLoading } = useListShootDays(projectId, {
    query: { enabled: !isNaN(projectId), queryKey: ["shootDays", projectId] },
  });

  const isLoading = projectLoading || daysLoading;

  const daysWithDates = shootDays
    .map((d) => ({ ...d, parsedDate: parseDate(d.date) }))
    .filter((d) => d.parsedDate !== null) as Array<(typeof shootDays[0]) & { parsedDate: Date }>;

  const undated = shootDays.filter((d) => !d.date);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <header className="px-4 py-3 border-b border-border bg-card sticky top-0 z-20">
          <Skeleton className="h-8 w-64 rounded-sm" />
        </header>
        <div className="flex-1 p-6">
          <Skeleton className="h-48 w-full rounded-sm" />
        </div>
      </div>
    );
  }

  // Compute date range
  let minDate: Date, maxDate: Date;
  if (daysWithDates.length === 0) {
    minDate = new Date();
    maxDate = addDays(new Date(), 30);
  } else {
    minDate = new Date(Math.min(...daysWithDates.map((d) => d.parsedDate.getTime())));
    maxDate = new Date(Math.max(...daysWithDates.map((d) => d.parsedDate.getTime())));
    maxDate = addDays(maxDate, 2);
    minDate = addDays(minDate, -2);
  }

  const totalDays = daysBetween(minDate, maxDate) + 1;
  const DAY_W = 40; // pixels per day
  const totalWidth = totalDays * DAY_W;

  // Build header days
  const headerDays: { label: string; isFirst: boolean }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(minDate, i);
    const isFirst = i === 0 || d.getDate() === 1;
    headerDays.push({
      label: isFirst ? `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}` : String(d.getDate()),
      isFirst,
    });
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="px-4 py-3 flex items-center justify-between border-b border-border bg-card sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-sm">
              <ChevronLeft className="w-4 h-4 mr-1" /> {project?.title ?? "Project"}
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" />
            <span className="font-serif font-medium tracking-tight">Timeline</span>
          </div>
        </div>
        <UserMenu />
      </header>

      <div className="flex-1 p-5 overflow-auto">
        {daysWithDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <CalendarDays className="w-10 h-10 text-muted-foreground mb-3 opacity-30" />
            <h2 className="font-serif text-xl font-medium mb-2">No dates scheduled</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Go to the Pre-Production stage and set dates on your shoot days to see them here on the timeline.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Gantt grid */}
            <div className="overflow-x-auto">
              <div style={{ minWidth: totalWidth + 200 }}>
                {/* Header row */}
                <div className="flex" style={{ marginLeft: 200 }}>
                  {headerDays.map((d, i) => (
                    <div
                      key={i}
                      style={{ width: DAY_W, minWidth: DAY_W }}
                      className={`text-[10px] font-mono text-center border-r border-border py-1 shrink-0 ${
                        d.isFirst ? "text-foreground font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {d.label}
                    </div>
                  ))}
                </div>

                {/* Shoot day rows */}
                {daysWithDates
                  .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
                  .map((day) => {
                    const offset = daysBetween(minDate, day.parsedDate);
                    return (
                      <div key={day.id} className="flex items-center h-10 border-b border-border/40">
                        {/* Row label */}
                        <div className="w-[200px] shrink-0 pr-4 text-right text-xs font-medium truncate">
                          <span className="text-muted-foreground font-mono text-[10px]">D{day.dayNumber}</span>{" "}
                          {day.label}
                        </div>
                        {/* Bar */}
                        <div className="relative flex-1" style={{ width: totalWidth }}>
                          <div
                            className="absolute top-1 h-7 bg-primary/80 rounded-[3px] flex items-center px-2 text-primary-foreground text-[10px] font-medium whitespace-nowrap overflow-hidden"
                            style={{ left: offset * DAY_W, width: DAY_W - 2 }}
                            title={`${day.label} — ${day.date}`}
                          >
                            {day.scheduledSceneIds.length > 0 && (
                              <span>{day.scheduledSceneIds.length} sc.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Undated days */}
            {undated.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Undated Shoot Days
                </h3>
                <div className="flex flex-wrap gap-2">
                  {undated.map((d) => (
                    <div key={d.id} className="px-3 py-1.5 bg-card border border-border rounded-[3px] text-xs font-medium">
                      <span className="text-muted-foreground font-mono">D{d.dayNumber}</span> {d.label}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Set dates in the Pre-Production stage to place these days on the timeline.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
