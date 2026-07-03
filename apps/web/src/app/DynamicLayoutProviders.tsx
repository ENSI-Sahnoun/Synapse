'use client';
import React, { Suspense, useEffect } from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';
import { InstallPromptModal } from '@/components/pwa/InstallPromptModal';

export function DynamicLayoutProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  return (
    <>
      {children}
      <Suspense>
        <ProgressBar
          height="4px"
          color="var(--accent-brand)"
          options={{ showSpinner: false }}
          shallowRouting
        />
        <SonnerToaster richColors theme="light" />
      </Suspense>
      <InstallPromptModal />
    </>
  );
}
