import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from '../features/auth/AuthProvider';
import { SmoothScroll } from '../components/animations/SmoothScroll';
import '../styles/tailwind.css';

const rootNode = document.getElementById('root');

if (!rootNode) {
  throw new Error('root element not found');
}

ReactDOM.createRoot(rootNode).render(
  <React.StrictMode>
    <SmoothScroll>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </SmoothScroll>
  </React.StrictMode>,
);
