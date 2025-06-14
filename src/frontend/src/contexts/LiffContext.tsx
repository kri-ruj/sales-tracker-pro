import React, { createContext, useContext, useState, useEffect } from 'react';
import liff from '@line/liff';

interface LiffContextType {
  liff: typeof liff | null;
  isInClient: boolean;
  isReady: boolean;
  error: string | null;
}

const LiffContext = createContext<LiffContextType | undefined>(undefined);

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isInClient, setIsInClient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeLiff();
  }, []);

  const initializeLiff = async () => {
    try {
      const liffId = import.meta.env.VITE_LIFF_ID || '2007552096-wrG1aV9p';
      
      await liff.init({ liffId });
      
      setIsInClient(liff.isInClient());
      setIsReady(true);

      // Auto-login if in LIFF client and not logged in
      if (liff.isInClient() && !liff.isLoggedIn()) {
        liff.login();
      }
    } catch (err: any) {
      console.error('LIFF initialization failed:', err);
      setError(err.message);
      setIsReady(true); // Still mark as ready to allow non-LIFF usage
    }
  };

  const value: LiffContextType = {
    liff: isReady ? liff : null,
    isInClient,
    isReady,
    error,
  };

  return <LiffContext.Provider value={value}>{children}</LiffContext.Provider>;
}

export function useLiff() {
  const context = useContext(LiffContext);
  if (context === undefined) {
    throw new Error('useLiff must be used within a LiffProvider');
  }
  return context;
}