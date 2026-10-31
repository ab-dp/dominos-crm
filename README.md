# Domino's CRM

מערכת CRM פנימית למוקד: לקוחות עסקיים, הזמנות הקפה והזמנות עתידיות.

- **אתר:** https://ab-dp.github.io/dominos-crm/
- **טכנולוגיה:** Vite + React + TypeScript, Firebase (Authentication + Firestore) בתוכנית החינמית
- **פריסה:** אוטומטית בכל עדכון ל-`main` (GitHub Actions ← GitHub Pages)

## פיתוח מקומי

```bash
npm install
npm run dev
```

## כללי אבטחה

הכללים נמצאים ב-`firestore.rules`. פרסום: `npx firebase-tools deploy --only firestore:rules` (אחרי `npx firebase-tools login` פעם אחת).

## מצב

שלב 2 – כניסה (Google או מייל וסיסמה), הרשמה, אישור מנהל וניהול משתמשים. ההזמנות עדיין נתוני דמה.
