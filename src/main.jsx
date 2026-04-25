import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

console.log('[RENDERER] main.jsx loading...');
const isElectron = typeof window.electronAPI !== 'undefined';
console.log('[RENDERER] isElectron:', isElectron);

const rootElement = document.getElementById('root');

function setUiReady() {
  try {
    const root = document.getElementById('root');
    const loader = document.getElementById('loader');
    if (root) root.classList.add('app-ready');
    if (loader) loader.classList.add('hidden');
  } catch (_) {}
}

function renderFatal(err, context = '') {
  try {
    setUiReady();
    const el = document.getElementById('root');
    if (!el) return;
    const msg = (err && (err.stack || err.message)) ? String(err.stack || err.message) : String(err);
    el.innerHTML =
      '<div style="padding:20px;font-family:system-ui;color:#0f172a;background:#fff;min-height:100vh;">' +
      '<div style="font-weight:700;font-size:16px;margin-bottom:10px;">💥 Ошибка загрузки приложения</div>' +
      (context ? '<div style="margin-bottom:10px;opacity:.75;">' + context + '</div>' : '') +
      '<pre style="background:#f1f5f9;padding:12px;border-radius:6px;overflow:auto;white-space:pre-wrap;word-break:break-word;">' +
      msg +
      '</pre>' +
      '<div style="margin-top:12px;opacity:.75;">Если это desktop-сборка, проверьте также <code>crash.log</code> в папке данных приложения (Electron userData).</div>' +
      '</div>';
  } catch (_) {}
}

window.addEventListener('error', (e) => {
  // Covers script load errors and runtime exceptions not caught by React.
  renderFatal(e?.error || e?.message || 'Unknown error', 'window.error');
});

window.addEventListener('unhandledrejection', (e) => {
  renderFatal(e?.reason || 'Unhandled rejection', 'unhandledrejection');
});

if (rootElement) {
  try {
    // Make UI visible as early as possible. If App fails before effects run, loader must not hang forever.
    setUiReady();
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (renderError) {
    console.error('[RENDERER] Render error:', renderError);
    renderFatal(renderError, 'React render');
  }
}

// Back-compat for older loader behavior (dev): ensure it is not left visible.
setUiReady();