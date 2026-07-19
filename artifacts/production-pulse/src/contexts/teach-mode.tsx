import { createContext, useContext, useState, type ReactNode } from "react";

interface TeachModeContextValue {
  teachMode: boolean;
  toggleTeachMode: () => void;
}

const TeachModeContext = createContext<TeachModeContextValue>({
  teachMode: false,
  toggleTeachMode: () => {},
});

export function TeachModeProvider({ children }: { children: ReactNode }) {
  const [teachMode, setTeachMode] = useState(() => {
    try { return localStorage.getItem("pp_teach_mode") === "1"; } catch { return false; }
  });

  function toggleTeachMode() {
    setTeachMode((prev) => {
      const next = !prev;
      try { localStorage.setItem("pp_teach_mode", next ? "1" : "0"); } catch {}
      return next;
    });
  }

  return (
    <TeachModeContext.Provider value={{ teachMode, toggleTeachMode }}>
      {children}
    </TeachModeContext.Provider>
  );
}

export function useTeachMode() {
  return useContext(TeachModeContext);
}
