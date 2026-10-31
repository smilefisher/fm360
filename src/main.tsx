import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { I18nProvider } from './i18n';
import { NIGHT, applyTheme } from './themes/night';
import './styles/global.css';
import './styles/app.css';

applyTheme(NIGHT);

// The visible static shell in index.html is for crawlers and the pre-JS paint.
// React takes over from here.
document.getElementById('seo-shell')?.remove();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
