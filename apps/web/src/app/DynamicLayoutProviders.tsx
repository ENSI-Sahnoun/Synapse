'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster as SonnerToaster } from 'sonner';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
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
            mobileOffset={{ left: 16, right: 16 }}
            icons={{
              success: <CheckCircle2 className="h-full w-full" />,
              error: <AlertCircle className="h-full w-full" />,
              warning: <AlertTriangle className="h-full w-full" />,
              info: <Info className="h-full w-full" />,
              loading: <Loader2 className="h-full w-full animate-spin" />,
            }}
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
