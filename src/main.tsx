import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans-hebrew/hebrew-400.css';
import '@fontsource/ibm-plex-sans-hebrew/hebrew-500.css';
import '@fontsource/ibm-plex-sans-hebrew/hebrew-600.css';
import '@fontsource/ibm-plex-sans-hebrew/hebrew-700.css';
import '@fontsource/ibm-plex-sans-hebrew/latin-400.css';
import '@fontsource/ibm-plex-sans-hebrew/latin-500.css';
import '@fontsource/ibm-plex-sans-hebrew/latin-600.css';
import '@fontsource/ibm-plex-sans-hebrew/latin-700.css';
import './design/tokens.css';
import './design/global.css';
import { App } from './App';
import { installGlobalErrorLog } from './lib/errorLog';

installGlobalErrorLog();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
