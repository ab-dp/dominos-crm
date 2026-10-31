/* תיק הזמנה נפתח מכל מקום (אפיון 3). בסגירה הפוקוס חוזר לאלמנט שממנו נפתח, והשורה מהבהבת פעם אחת. */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type PanelApi = {
  openId: number | null;
  open: (id: number, from?: HTMLElement | null) => void;
  close: () => void;
  lastClosed: number | null;
};

const Ctx = createContext<PanelApi | null>(null);
export function usePanel() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePanel outside provider');
  return c;
}

export function PanelProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [lastClosed, setLastClosed] = useState<number | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const open = useCallback((id: number, from?: HTMLElement | null) => {
    returnTo.current = from ?? (document.activeElement as HTMLElement | null);
    setLastClosed(null);
    setOpenId(id);
  }, []);

  const close = useCallback(() => {
    setOpenId((id) => {
      setLastClosed(id);
      return null;
    });
    const el = returnTo.current;
    requestAnimationFrame(() => el?.focus({ preventScroll: false }));
  }, []);

  return <Ctx.Provider value={{ openId, open, close, lastClosed }}>{children}</Ctx.Provider>;
}
