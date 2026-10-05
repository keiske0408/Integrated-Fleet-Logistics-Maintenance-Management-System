import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeAuthClient } from './lib/authClient';

const root = ReactDOM.createRoot(document.getElementById('root')!);
void initializeAuthClient()
  .catch(() => undefined)
  .finally(() => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
