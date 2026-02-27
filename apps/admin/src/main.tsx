import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
const base = (import.meta as any).env.VITE_BASE_PATH || '/admin';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter basename={base}><App /></BrowserRouter></React.StrictMode>
);
