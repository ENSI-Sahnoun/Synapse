'use client';
import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'pwa-install-dismissed';
const TRIGGER_KEY = 'pwa-install-trigger';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Storage access throws SecurityError in some browsers (Firefox with cookies
// blocked, private mode, iframe contexts) — never let that crash the app.
function storageGet(storage: 'local' | 'session', key: string): string | null {
  try {
    return (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function storageSet(storage: 'local' | 'session', key: string, value: string | null) {
  try {
    const s = storage === 'local' ? window.localStorage : window.sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    // ignore — feature degrades gracefully
  }
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
  storageSet('session', TRIGGER_KEY, '1');
}

export function usePwaInstall() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'android-manual' | 'ios' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (storageGet('local', DISMISSED_KEY)) return;
    if (isStandalone()) return;
    if (!isMobile()) return;
    if (!storageGet('session', TRIGGER_KEY)) return;

    if (isIos()) {
      setPlatform('ios');
      setOpen(true);
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      clearTimeout(fallbackTimer);
      if (storageGet('local', DISMISSED_KEY)) return;
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
      storageSet('local', DISMISSED_KEY, '1');
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
    storageSet('local', DISMISSED_KEY, '1');
    storageSet('session', TRIGGER_KEY, null);
    setOpen(false);
  }

  async function install() {
    storageSet('session', TRIGGER_KEY, null);
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    storageSet('local', DISMISSED_KEY, '1');
    setDeferredPrompt(null);
    setOpen(false);
    return outcome;
  }

  return { open, platform, install, dismiss };
}
