import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { initializeAuthClient } from './lib/authClient';

// Intercept and handle asynchronous browser storage quota errors gracefully
if (typeof window !== 'undefined') {
  const isQuotaMsg = (msg: string) =>
    msg.includes('kQuotaBytes') ||
    msg.includes('quota exceeded') ||
    msg.includes('QUOTA_BYTES') ||
    msg.includes('QuotaExceeded');

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reason = event.reason;
      const msg = String(reason?.message || reason || '');
      if (isQuotaMsg(msg) || reason?.name === 'QuotaExceededError') {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  window.addEventListener(
    'error',
    (event) => {
      const msg = String(event.message || event.error || '');
      if (isQuotaMsg(msg)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
void initializeAuthClient()
  .catch(() => undefined)
  .finally(() => {
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>,
    );
  });
