import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface DemoContextValue {
  isDemo: boolean;
  demoUserId: string | null;
  isLoading: boolean;
  startDemo: () => Promise<{ projectId: number | null }>;
  exitDemo: () => Promise<void>;
}

const DemoContext = createContext<DemoContextValue>({
  isDemo: false,
  demoUserId: null,
  isLoading: true,
  startDemo: async () => ({ projectId: null }),
  exitDemo: async () => {},
});

const DEMO_LOCAL_STORAGE_KEY = "pp_demo_mode";

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DEMO_LOCAL_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [demoUserId, setDemoUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch("/api/me/demo", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to verify demo session");
        const data = (await res.json()) as { demoUserId: string | null };
        if (!cancelled) {
          if (data.demoUserId) {
            setIsDemo(true);
            setDemoUserId(data.demoUserId);
            try { localStorage.setItem(DEMO_LOCAL_STORAGE_KEY, "true"); } catch {}
          } else {
            setIsDemo(false);
            setDemoUserId(null);
            try { localStorage.removeItem(DEMO_LOCAL_STORAGE_KEY); } catch {}
          }
        }
      } catch {
        if (!cancelled) {
          setIsDemo(false);
          setDemoUserId(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkSession();
    return () => { cancelled = true; };
  }, []);

  const startDemo = async () => {
    const res = await fetch("/api/demo-session", { method: "POST", credentials: "include" });
    if (!res.ok) throw new Error("Failed to start demo session");
    const data = (await res.json()) as { demoUserId: string; projectId: number | null };
    setIsDemo(true);
    setDemoUserId(data.demoUserId);
    try { localStorage.setItem(DEMO_LOCAL_STORAGE_KEY, "true"); } catch {}
    return { projectId: data.projectId };
  };

  const exitDemo = async () => {
    await fetch("/api/demo-session", { method: "DELETE", credentials: "include" });
    setIsDemo(false);
    setDemoUserId(null);
    try { localStorage.removeItem(DEMO_LOCAL_STORAGE_KEY); } catch {}
  };

  return (
    <DemoContext.Provider value={{ isDemo, demoUserId, isLoading, startDemo, exitDemo }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}
