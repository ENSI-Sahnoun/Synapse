'use client';
import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'pwa-install-dismissed';
const TRIGGER_KEY = 'pwa-install-trigger';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function markPwaInstallTrigger() {
  sessionStorage.setItem(TRIGGER_KEY, '1');
}

export function usePwaInstall() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'android-manual' | 'ios' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (isStandalone()) return;
    if (!isMobile()) return;
    if (!sessionStorage.getItem(TRIGGER_KEY)) return;

    if (isIos()) {
      setPlatform('ios');
      setOpen(true);
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      clearTimeout(fallbackTimer);
      if (localStorage.getItem(DISMISSED_KEY)) return;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform('android');
      setOpen(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    // Samsung Internet and other non-Chromium browsers don't fire
    // beforeinstallprompt at all — fall back to manual instructions.
    const fallbackTimer = setTimeout(() => {
      setPlatform('android-manual');
      setOpen(true);
    }, 2500);

    const onInstalled = () => {
      localStorage.setItem(DISMISSED_KEY, '1');
      setOpen(false);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      clearTimeout(fallbackTimer);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    sessionStorage.removeItem(TRIGGER_KEY);
    setOpen(false);
  }

  async function install() {
    sessionStorage.removeItem(TRIGGER_KEY);
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    localStorage.setItem(DISMISSED_KEY, '1');
    setDeferredPrompt(null);
    setOpen(false);
    return outcome;
  }

  return { open, platform, install, dismiss };
}
