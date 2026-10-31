import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// האתר מתפרסם בכתובת ab-dp.github.io/dominos-crm/
export default defineConfig({
  base: '/dominos-crm/',
  plugins: [react()],
});
