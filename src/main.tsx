import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setLanguage } from './i18n';
import { registerServiceWorker } from './lib/pwa';
import { useSettings } from './state/settings';
import './index.css';

async function boot() {
  await useSettings.getState().hydrate();
  await setLanguage(useSettings.getState().settings.language);
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
