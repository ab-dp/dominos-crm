import { jsx as _jsx } from "react/jsx-runtime";
/* תיק הזמנה נפתח מכל מקום (אפיון 3). בסגירה הפוקוס חוזר לאלמנט שממנו נפתח, והשורה מהבהבת פעם אחת. */
import { createContext, useCallback, useContext, useRef, useState } from 'react';
const Ctx = createContext(null);
export function usePanel() {
    const c = useContext(Ctx);
    if (!c)
        throw new Error('usePanel outside provider');
    return c;
}
export function PanelProvider({ children }) {
    const [openId, setOpenId] = useState(null);
    const [lastClosed, setLastClosed] = useState(null);
    const returnTo = useRef(null);
    const open = useCallback((id, from) => {
        returnTo.current = from ?? document.activeElement;
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
    return _jsx(Ctx.Provider, { value: { openId, open, close, lastClosed }, children: children });
}
