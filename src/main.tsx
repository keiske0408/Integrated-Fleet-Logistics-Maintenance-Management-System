import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { initializeAuthClient } from './lib/authClient';

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
