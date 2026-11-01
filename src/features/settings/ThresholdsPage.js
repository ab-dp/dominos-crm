import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/* ספי התראות (מנהל בלבד): ארבעה ערכים שקובעים מתי הזמנה הופכת לדחופה או לחריגה. נשמר ביומן. */
import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DEFAULT_THRESHOLDS, THRESHOLD_META, saveThresholds, useThresholds } from '../../data/thresholds';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import '../pages.css';
import './ThresholdsPage.css';
const KEYS = ['qLeadMinutes', 'soonDays', 'creditDeadline', 'nearMinutes'];
export function ThresholdsPage() {
    const { th, saved } = useThresholds();
    const toast = useToast();
    const [draft, setDraft] = useState(th);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    useEffect(() => setDraft(th), [th]);
    const dirty = KEYS.some((k) => draft[k] !== th[k]);
    const validate = () => {
        for (const k of KEYS) {
            const m = THRESHOLD_META[k];
            if (k === 'creditDeadline') {
                if (!/^\d{2}:\d{2}$/.test(draft[k]))
                    return `${m.title}: שעה בפורמט 12:00`;
                continue;
            }
            const v = draft[k];
            if (!Number.isFinite(v) || v < m.min || v > m.max)
                return `${m.title}: בין ${m.min} ל-${m.max} ${m.unit}`;
        }
        return '';
    };
    const save = async () => {
        const e = validate();
        if (e)
            return setErr(e);
        setBusy(true);
        try {
            await saveThresholds(draft, th);
            toast({ message: 'ספי ההתראות נשמרו – החריגים מחושבים מחדש לכולם' });
        }
        catch {
            setErr('השמירה נכשלה – בדוק חיבור');
        }
        setBusy(false);
    };
    return (_jsxs("div", { className: "page", children: [_jsx("header", { className: "page__head", children: _jsxs("div", { children: [_jsx("h1", { className: "page__title", children: "\u05E1\u05E4\u05D9 \u05D4\u05EA\u05E8\u05D0\u05D5\u05EA" }), _jsx("p", { className: "page__sub", children: "\u05DE\u05EA\u05D9 \u05D4\u05D6\u05DE\u05E0\u05D4 \u05E0\u05D7\u05E9\u05D1\u05EA \u05D3\u05D7\u05D5\u05E4\u05D4 \u05D0\u05D5 \u05D7\u05E8\u05D9\u05D2\u05D4. \u05D4\u05E9\u05D9\u05E0\u05D5\u05D9 \u05D7\u05DC \u05DE\u05D9\u05D3 \u05E2\u05DC \u05DB\u05DC \u05D4\u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD, \u05D5\u05E0\u05E8\u05E9\u05DD \u05D1\u05D9\u05D5\u05DE\u05DF." })] }) }), _jsxs("div", { className: "card thr", children: [KEYS.map((k) => {
                        const m = THRESHOLD_META[k];
                        const isTime = k === 'creditDeadline';
                        return (_jsxs("label", { className: "thr__row", children: [_jsxs("span", { className: "thr__text", children: [_jsx("b", { children: m.title }), _jsx("span", { children: m.hint })] }), _jsxs("span", { className: "thr__input", children: [_jsx("input", { className: "input input--ltr", type: isTime ? 'time' : 'number', min: isTime ? undefined : m.min, max: isTime ? undefined : m.max, step: isTime ? 900 : 1, value: draft[k], onChange: (e) => { setErr(''); setDraft({ ...draft, [k]: isTime ? e.target.value : Number(e.target.value) }); } }), !isTime && _jsx("span", { className: "thr__unit", children: m.unit }), draft[k] !== DEFAULT_THRESHOLDS[k] && _jsxs("span", { className: "thr__def", children: ["\u05D1\u05E8\u05D9\u05E8\u05EA \u05DE\u05D7\u05D3\u05DC: ", DEFAULT_THRESHOLDS[k]] })] })] }, k));
                    }), _jsxs("div", { className: "thr__foot", children: [err && _jsx("span", { className: "cform__err", role: "alert", children: err }), !saved && !dirty && _jsx("span", { className: "muted", children: "\u05E4\u05D5\u05E2\u05DC \u05DC\u05E4\u05D9 \u05D1\u05E8\u05D9\u05E8\u05D5\u05EA \u05D4\u05DE\u05D7\u05D3\u05DC" }), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(RotateCcw, { size: 14 }), disabled: KEYS.every((k) => draft[k] === DEFAULT_THRESHOLDS[k]), onClick: () => setDraft(DEFAULT_THRESHOLDS), children: "\u05D7\u05D6\u05E8\u05D4 \u05DC\u05D1\u05E8\u05D9\u05E8\u05D5\u05EA \u05D4\u05DE\u05D7\u05D3\u05DC" }), _jsx(Button, { variant: "primary", loading: busy, disabled: !dirty, onClick: save, children: "\u05E9\u05DE\u05D5\u05E8" })] })] })] }));
}
