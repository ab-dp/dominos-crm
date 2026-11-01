import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// האתר מתארח ב-Firebase Hosting: https://dominos-crm.firebaseapp.com (באותה כתובת של ההתחברות –
// כך התחברות עם Google עובדת גם בדפדפני נייד שחוסמים אחסון בין אתרים). הכתובת הישנה ב-GitHub מפנה לכאן.
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    // ספריות חיצוניות בקבצים נפרדים: הן כמעט לא משתנות, ולכן נשארות שמורות בדפדפן גם אחרי עדכון של המערכת
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // firebase לא תלוי בשאר; כל השאר יחד – פיצול בין react לספריות שתלויות בו יצר תלות מעגלית ודף ריק
          if (id.includes('firebase')) return 'firebase';
          return 'vendor';
        },
      },
    },
  },
});
