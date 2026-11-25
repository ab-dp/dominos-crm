/* בדיקות "תמונת מצב" (vitest). קובץ נפרד מ-vite.config.ts בכוונה – לא נוגעים בפיצול הצ'אנקים של האתר.
   הבדיקות רצות ב-Node, בלי דפדפן ובלי Firebase אמיתי (ראו tests/setup.ts). */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    css: false,
    /* כל התאריכים והשעות בבדיקות לפי שעון ישראל, בלי קשר למחשב שמריץ אותן */
    env: { TZ: 'Asia/Jerusalem' },
  },
});
