import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import { AuthProvider } from './contexts/AuthContext';
import { LiffProvider } from './contexts/LiffContext';
import { initializeLiff } from './services/liff.service';

// Initialize React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Initialize LIFF
initializeLiff().then(() => {
  console.log('LIFF initialized');
}).catch((error) => {
  console.error('LIFF initialization failed:', error);
});

// Render app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LiffProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LiffProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);