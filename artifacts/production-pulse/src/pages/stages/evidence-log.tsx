import { format } from "date-fns";
import { useListEvidenceLog, getListEvidenceLogQueryKey } from "@workspace/api-client-react";
import { Activity, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function EvidenceLog({ projectId }: { projectId: number }) {
  const { data: page, isLoading, error } = useListEvidenceLog(projectId, {
    query: { enabled: !!projectId, queryKey: getListEvidenceLogQueryKey(projectId) }
  });

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto w-full space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-sm" />
          <Skeleton className="h-4 w-96 rounded-sm" />
        </div>
        <div className="space-y-4 pt-6 border-t border-border">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-16 w-full rounded-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 md:p-10 flex flex-col items-center justify-center text-center">
        <div className="bg-destructive/10 text-destructive p-4 rounded-sm border border-destructive/20 max-w-md">
          <p className="font-medium mb-1">Could not load evidence log</p>
          <p className="text-sm">There was an error fetching the history for this project.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto w-full">
      <div className="mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="font-serif text-2xl font-medium text-foreground tracking-tight">Evidence Log</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          A secure, immutable timeline of significant actions taken on this project.
        </p>
      </div>

      {!page?.entries || page.entries.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-sm bg-card/50">
          <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="font-serif text-lg font-medium text-foreground mb-1">No log entries</h3>
          <p className="text-sm text-muted-foreground">Actions like script breakdowns and scene corrections will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {page.entries.map((entry) => (
            <div key={entry.id} className="p-4 bg-card border border-border shadow-sm rounded-sm flex flex-col sm:flex-row gap-4 sm:items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs uppercase tracking-wider font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-sm">
                    {entry.actionType.replace(/_/g, ' ')}
                  </span>
                  {entry.entityType && (
                    <span className="text-xs text-muted-foreground">
                      {entry.entityType} {entry.entityId ? `#${entry.entityId}` : ''}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground">{entry.summary}</p>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap pt-1 sm:pt-0 border-t border-border sm:border-0 mt-3 sm:mt-0">
                {format(new Date(entry.createdAt), "MMM d, yyyy h:mm a")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
