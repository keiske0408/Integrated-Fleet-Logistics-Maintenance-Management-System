import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { initializeAuthClient } from './lib/authClient';

// Intercept and handle asynchronous browser storage quota errors gracefully
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason || '');
    if (
      msg.includes('kQuotaBytes') ||
      msg.includes('quota exceeded') ||
      msg.includes('QUOTA_BYTES') ||
      reason?.name === 'QuotaExceededError'
    ) {
      event.preventDefault();
    }
  });
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
