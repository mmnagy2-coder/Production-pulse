import { HelpCircle, X } from "lucide-react";
import { useState } from "react";
import { useTeachMode } from "@/contexts/teach-mode";

interface TeachTipProps {
  title?: string;
  children: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
}

export function TeachTip({ title, children }: TeachTipProps) {
  const { teachMode } = useTeachMode();
  const [dismissed, setDismissed] = useState(false);

  if (!teachMode || dismissed) return null;

  return (
    <div className="relative my-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-[3px] px-4 py-3 pr-9">
      <div className="flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          {title && (
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1">
              {title}
            </p>
          )}
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{children}</p>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-amber-500 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-300"
        aria-label="Dismiss tip"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
