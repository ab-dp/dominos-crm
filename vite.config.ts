import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// האתר מתארח ב-Firebase Hosting: https://dominos-crm.firebaseapp.com (באותה כתובת של ההתחברות –
// כך התחברות עם Google עובדת גם בדפדפני נייד שחוסמים אחסון בין אתרים). הכתובת הישנה ב-GitHub מפנה לכאן.
export default defineConfig({
  base: '/',
  plugins: [react()],
});
