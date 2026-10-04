import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setLanguage } from './i18n';
import { registerServiceWorker } from './lib/pwa';
import { useData } from './state/data';
import { useSettings } from './state/settings';
import './index.css';

async function boot() {
  // Opening the database runs any pending upgrade (v1 → v2) before the first render.
  await Promise.all([useSettings.getState().hydrate(), useData.getState().load()]);
  await setLanguage(useSettings.getState().settings.language);
  if (import.meta.env.DEV) {
    // In the browser console: `await term.seedDemo()` loads DESIGN's example week.
    const { seedDemo } = await import('./state/seed');
    Object.assign(window, { term: { seedDemo } });
  }
  const root = document.getElementById('root');
  if (!root) throw new Error('#root missing');
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  registerServiceWorker();
}

void boot();
