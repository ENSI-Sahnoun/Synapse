'use client';
import React, { Suspense } from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';

export function DynamicLayoutProviders({ children }: { children: React.ReactNode }) {
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
    </>
  );
}
