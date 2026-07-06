'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';
import { InstallPromptModal } from '@/components/pwa/InstallPromptModal';
import { NotificationToaster } from '@/components/notifications/NotificationToaster';
import { PushPromptModal } from '@/components/notifications/PushPromptModal';
import { DebugErrorOverlay } from '@/components/DebugErrorOverlay';

export function DynamicLayoutProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  return (
    <>
      {children}
      {mounted && (
        <Suspense>
          <ProgressBar
            height="4px"
            color="var(--accent-brand)"
            options={{ showSpinner: false }}
            shallowRouting
          />
          <SonnerToaster richColors theme="light" />
          <NotificationToaster />
          <PushPromptModal />
        </Suspense>
      )}
      <InstallPromptModal />
      <DebugErrorOverlay />
    </>
  );
}
