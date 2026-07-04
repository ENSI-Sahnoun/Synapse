'use client';
import { Email } from '@/components/Auth/Email';
import { EmailAndPassword } from '@/components/Auth/EmailAndPassword';
import { QrLoginPanel } from '@/components/Auth/QrLoginPanel';
import { RedirectingPleaseWaitCard } from '@/components/Auth/RedirectingPleaseWaitCard';
import { RenderProviders } from '@/components/Auth/RenderProviders';
import { StudentSignup } from '@/app/(auth-pages)/sign-up/StudentSignup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  resetPasswordAction,
  signInWithPasswordAction,
  signInWithProviderAction,
} from '@/data/auth/auth';
import { useAction } from 'next-safe-action/hooks';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { markPwaInstallTrigger } from '@/components/pwa/usePwaInstall';

const QR_COLS = 10;
const QR_ROWS = 14;
const QR_PAD = 24; // matches the field's p-6
const HOVER_RADIUS = 110;

// Deterministic pseudo-random so server and client render identically.
function qrRand(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type MousePos = { x: number; y: number; w: number; h: number } | null;

/**
 * Ambient QR-dot field on the brand panel — echoes the student QR card.
 * A sparse grid of dots; a handful twinkle in orange on a slow, staggered
 * cycle, and dots near the cursor light up and swell. Ambient motion is
 * disabled under prefers-reduced-motion.
 */
function QrField({ mouse }: { mouse: MousePos }) {
  return (
    <>
      <style>{`
        @keyframes qr-twinkle {
          0%, 100% { background: rgba(255,255,255,0.06); }
          50% { background: var(--synapse-orange-400); box-shadow: 0 0 12px rgba(245,149,66,0.45); }
        }
        @keyframes qr-glow-drift {
          0%, 100% { transform: translate(-20%, -10%); }
          50% { transform: translate(15%, 20%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .qr-cell-live, .qr-glow { animation: none !important; }
        }
      `}</style>

      {/* Drifting warm glow behind the dots */}
      <div
        aria-hidden
        className="qr-glow pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(45% 35% at 60% 45%, rgba(162,114,74,0.35), transparent 70%)',
          animation: 'qr-glow-drift 18s ease-in-out infinite',
        }}
      />

      {/* Cursor halo */}
      {mouse && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            left: mouse.x - HOVER_RADIUS,
            top: mouse.y - HOVER_RADIUS,
            width: HOVER_RADIUS * 2,
            height: HOVER_RADIUS * 2,
            background:
              'radial-gradient(circle, rgba(245,149,66,0.14), transparent 70%)',
          }}
        />
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid content-between p-6"
        style={{
          gridTemplateColumns: `repeat(${QR_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${QR_ROWS}, 1fr)`,
        }}
      >
        {Array.from({ length: QR_COLS * QR_ROWS }, (_, i) => {
          const r = qrRand(i);
          if (r < 0.55) return <span key={i} />;
          const live = r > 0.92;

          // Proximity to the cursor: 0 (far) → 1 (under it)
          let heat = 0;
          if (mouse) {
            const col = i % QR_COLS;
            const row = Math.floor(i / QR_COLS);
            const cx = QR_PAD + ((col + 0.5) * (mouse.w - QR_PAD * 2)) / QR_COLS;
            const cy = QR_PAD + ((row + 0.5) * (mouse.h - QR_PAD * 2)) / QR_ROWS;
            const d = Math.hypot(mouse.x - cx, mouse.y - cy);
            heat = Math.max(0, 1 - d / HOVER_RADIUS);
          }

          const hot = heat > 0.05;
          return (
            <span key={i} className="flex items-center justify-center">
              <span
                className={live && !hot ? 'qr-cell-live' : undefined}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  background: hot
                    ? `rgba(245, 149, 66, ${0.15 + heat * 0.85})`
                    : 'rgba(255,255,255,0.06)',
                  transform: hot ? `scale(${1 + heat * 0.9})` : undefined,
                  boxShadow: hot
                    ? `0 0 ${Math.round(heat * 14)}px rgba(245,149,66,${heat * 0.5})`
                    : undefined,
                  transition:
                    'background 200ms ease, transform 200ms ease, box-shadow 200ms ease',
                  ...(live && !hot
                    ? {
                        animation: `qr-twinkle ${6 + qrRand(i + 1) * 6}s ease-in-out ${qrRand(i + 2) * 8}s infinite`,
                      }
                    : {}),
                }}
              />
            </span>
          );
        })}
      </div>
    </>
  );
}

type Mode = 'login' | 'signup' | 'forgot';

export function Login({
  next,
  nextActionType: _nextActionType,
}: {
  next?: string;
  nextActionType?: string;
}) {
  const [mode, setMode] = useState<Mode>('login');
  const [redirectInProgress, setRedirectInProgress] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const toastRef = useRef<string | number | undefined>(undefined);

  const [mouse, setMouse] = useState<MousePos>(null);
  const mouseRaf = useRef<number | null>(null);
  const handlePanelMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const next = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        w: rect.width,
        h: rect.height,
      };
      if (mouseRaf.current !== null) return;
      mouseRaf.current = requestAnimationFrame(() => {
        mouseRaf.current = null;
        setMouse(next);
      });
    },
    []
  );

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

  const { execute: executeReset, status: resetStatus } = useAction(
    resetPasswordAction,
    {
      onSuccess: () => {
        setResetSent(true);
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? "Échec de l'envoi du lien");
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
          className="relative flex items-center justify-center overflow-hidden p-6 md:w-[42%] md:p-10"
          style={{ background: 'var(--synapse-stone-900)' }}
          onMouseMove={handlePanelMouseMove}
          onMouseLeave={() => setMouse(null)}
        >
          <QrField mouse={mouse} />
          <div className="relative flex flex-col items-center gap-4 text-center">
            <div
              className="flex items-center justify-center rounded-full p-3 md:p-4"
              style={{
                background: 'var(--synapse-cream-100)',
                boxShadow: '0 0 40px rgba(245,149,66,0.18)',
              }}
            >
              <Image
                src="/logos/synapse-logo-nobg.png"
                alt="Synapse"
                width={120}
                height={120}
                priority
                className="h-16 w-16 md:h-28 md:w-28"
              />
            </div>
            <p
              className="hidden text-sm leading-relaxed md:block md:max-w-[24ch]"
              style={{ color: 'var(--synapse-stone-400)' }}
            >
              Votre espace d'étude. Scannez votre carte ou connectez-vous pour
              continuer.
            </p>
          </div>
        </div>

        {/* Auth panel */}
        <div className="flex-1 p-6 md:p-10">
          {mode === 'signup' ? (
            <>
              <h1
                className="text-xl"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
              >
                Créer un compte
              </h1>
              <p className="mt-1 mb-5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Espace Synapse — étudiants uniquement.
              </p>
              <StudentSignup embedded onBack={() => setMode('login')} />
            </>
          ) : mode === 'forgot' ? (
            <>
              <h1
                className="text-xl"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
              >
                Mot de passe oublié
              </h1>
              {resetSent ? (
                <div className="mt-4 space-y-4">
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Un lien de réinitialisation a été envoyé à votre email.
                    Vérifiez votre boîte de réception.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setResetSent(false);
                      setMode('login');
                    }}
                    className="text-sm font-medium hover:underline"
                    style={{ color: 'var(--text-brand)' }}
                  >
                    ← Retour à la connexion
                  </button>
                </div>
              ) : (
                <>
                  <p className="mt-1 mb-5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Entrez votre email pour recevoir un lien de
                    réinitialisation.
                  </p>
                  <Email
                    onSubmit={(email) => executeReset({ email })}
                    isLoading={resetStatus === 'executing'}
                    view="forgot-password"
                  />
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="mt-4 text-sm font-medium hover:underline"
                    style={{ color: 'var(--text-brand)' }}
                  >
                    ← Retour à la connexion
                  </button>
                </>
              )}
            </>
          ) : (
            <>
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
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--text-brand)' }}
                    >
                      Mot de passe oublié ?
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--text-brand)' }}
                    >
                      Créer un compte
                    </button>
                  </div>
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
                  <div className="mt-4 text-right text-sm">
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--text-brand)' }}
                    >
                      Créer un compte
                    </button>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
