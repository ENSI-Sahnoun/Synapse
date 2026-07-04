'use client';
import { EmailAndPassword } from '@/components/Auth/EmailAndPassword';
import { QrLoginPanel } from '@/components/Auth/QrLoginPanel';
import { RedirectingPleaseWaitCard } from '@/components/Auth/RedirectingPleaseWaitCard';
import { RenderProviders } from '@/components/Auth/RenderProviders';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  signInWithPasswordAction,
  signInWithProviderAction,
} from '@/data/auth/auth';
import { useAction } from 'next-safe-action/hooks';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { markPwaInstallTrigger } from '@/components/pwa/usePwaInstall';

/** QR-dot cluster — echoes the student QR card on the brand panel. */
function QrMotif() {
  const cells = [
    1, 1, 1, 0, 1, 0, 1,
    1, 0, 1, 0, 0, 1, 0,
    1, 1, 1, 0, 1, 0, 1,
    0, 0, 0, 0, 0, 1, 0,
    1, 0, 1, 0, 1, 1, 1,
    0, 1, 0, 0, 1, 0, 1,
    1, 0, 1, 0, 1, 1, 1,
  ];
  return (
    <div
      aria-hidden
      className="grid gap-1.5"
      style={{ gridTemplateColumns: 'repeat(7, 10px)' }}
    >
      {cells.map((on, i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rounded-[2px]"
          style={{
            background: on
              ? 'var(--synapse-orange-400)'
              : 'rgba(255,255,255,0.08)',
            opacity: on ? 0.9 : 1,
          }}
        />
      ))}
    </div>
  );
}

export function Login({
  next,
  nextActionType: _nextActionType,
}: {
  next?: string;
  nextActionType?: string;
}) {
  const [redirectInProgress, setRedirectInProgress] = useState(false);
  const toastRef = useRef<string | number | undefined>(undefined);

  const goTo = (fallback: string) => {
    setRedirectInProgress(true);
    markPwaInstallTrigger();
    window.location.href = next ? decodeURIComponent(next) : fallback;
  };

  const { execute: executePassword, status: passwordStatus } = useAction(
    signInWithPasswordAction,
    {
      onExecute: () => {
        toastRef.current = toast.loading('Connexion...');
      },
      onSuccess: (payload) => {
        toast.success('Connecté !', { id: toastRef.current });
        toastRef.current = undefined;
        goTo(payload.data?.redirectTo ?? '/login');
      },
      onError: (error) => {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Email ou mot de passe incorrect.';
        toast.error(errorMessage, { id: toastRef.current });
        toastRef.current = undefined;
      },
    }
  );

  const { execute: executeProvider, status: providerStatus } = useAction(
    signInWithProviderAction,
    {
      onExecute: () => {
        toastRef.current = toast.loading('Redirection...');
      },
      onSuccess: (payload) => {
        toast.success('Redirection...', { id: toastRef.current });
        toastRef.current = undefined;
        window.location.href = payload.data?.url || '/';
      },
      onError: () => {
        toast.error('Échec de la connexion', { id: toastRef.current });
        toastRef.current = undefined;
      },
    }
  );

  if (redirectInProgress) {
    return (
      <div className="container flex h-full min-h-[470px] max-w-lg items-center justify-center">
        <RedirectingPleaseWaitCard
          message="Veuillez patienter pendant la redirection vers votre espace."
          heading="Redirection en cours"
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      <div
        className="flex flex-col overflow-hidden rounded-2xl shadow-lg md:min-h-[540px] md:flex-row"
        style={{ background: 'var(--bg-surface)' }}
      >
        {/* Brand panel */}
        <div
          className="flex items-center justify-between gap-4 p-6 md:w-[42%] md:flex-col md:items-start md:justify-between md:p-10"
          style={{ background: 'var(--synapse-stone-900)' }}
        >
          <div>
            <p
              className="text-2xl tracking-tight md:text-3xl"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                color: 'var(--synapse-cream-100)',
              }}
            >
              Synapse
            </p>
            <p
              className="mt-1 hidden text-sm leading-relaxed md:block md:max-w-[24ch]"
              style={{ color: 'var(--synapse-stone-400)' }}
            >
              Votre espace d'étude. Scannez votre carte ou connectez-vous pour
              continuer.
            </p>
          </div>
          <div className="shrink-0 md:self-end">
            <QrMotif />
          </div>
        </div>

        {/* Auth panel */}
        <div className="flex-1 p-6 md:p-10">
          <h1
            className="text-xl"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
          >
            Connexion
          </h1>
          <p className="mt-1 mb-5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Heureux de vous revoir.
          </p>

          <Tabs defaultValue="password">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="password">Mot de passe</TabsTrigger>
              <TabsTrigger value="qr">Carte QR</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
            </TabsList>

            <TabsContent value="password" className="pt-5">
              <EmailAndPassword
                isLoading={passwordStatus === 'executing'}
                onSubmit={(data) => {
                  executePassword({
                    email: data.email,
                    password: data.password,
                  });
                }}
                view="sign-in"
              />
              <p className="mt-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                <Link
                  href="/forgot-password"
                  className="font-medium hover:underline"
                  style={{ color: 'var(--text-brand)' }}
                >
                  Mot de passe oublié ?
                </Link>
              </p>
            </TabsContent>

            <TabsContent value="qr" className="pt-5">
              <QrLoginPanel onSuccess={(redirectTo) => goTo(redirectTo)} />
            </TabsContent>

            <TabsContent value="social" className="pt-5">
              <RenderProviders
                providers={['google', 'github', 'twitter']}
                isLoading={providerStatus === 'executing'}
                onProviderLoginRequested={(
                  provider: 'google' | 'github' | 'twitter'
                ) => executeProvider({ provider, next })}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
