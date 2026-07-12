'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster as SonnerToaster } from 'sonner';
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';
import { InstallPromptModal } from '@/components/pwa/InstallPromptModal';
import { NotificationToaster } from '@/components/notifications/NotificationToaster';
import { AirdropPopup } from '@/components/notifications/AirdropPopup';
import { PushPromptModal } from '@/components/notifications/PushPromptModal';

export function DynamicLayoutProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const isKiosk = pathname?.startsWith('/kiosk');

  useEffect(() => {
    setMounted(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  return (
    <>
      {children}
      {mounted && !isKiosk && (
        <Suspense>
          <ProgressBar
            height="4px"
            color="var(--accent-brand)"
            options={{ showSpinner: false }}
            shallowRouting
          />
          <SonnerToaster
            richColors
            theme="light"
            toastOptions={{
              classNames: {
                actionButton: '!bg-primary !text-primary-foreground !font-semibold hover:!bg-[var(--primary-hover)]',
                cancelButton: '!bg-muted !text-muted-foreground',
              },
            }}
          />
          <NotificationToaster />
          <AirdropPopup />
          <PushPromptModal />
        </Suspense>
      )}
      {!isKiosk && <InstallPromptModal />}
    </>
  );
}
