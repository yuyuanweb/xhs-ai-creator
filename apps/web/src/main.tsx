import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles.css';
import './studio.css';
import './render/card.css';
import './render/themes/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
