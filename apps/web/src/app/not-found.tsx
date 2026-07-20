'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="nf-shape nf-shape-1" />
        <span className="nf-shape nf-shape-2" />
        <span className="nf-shape nf-shape-3" />
      </div>

      <div className="nf-enter relative z-10 flex flex-col items-center">
        <div className="flex select-none items-end" style={{ fontFamily: "'DM Serif Display', serif" }}>
          <span className="nf-digit nf-digit-1 text-[clamp(4rem,18vw,9rem)] leading-none text-primary">4</span>
          <span className="nf-digit nf-digit-2 text-[clamp(4rem,18vw,9rem)] leading-none text-primary">0</span>
          <span className="nf-digit nf-digit-3 text-[clamp(4rem,18vw,9rem)] leading-none text-primary">4</span>
        </div>

        <p className="nf-fade mt-4 text-lg font-medium text-foreground">
          Cette page a pris une pause café.
        </p>
        <p className="nf-fade nf-fade-delay mt-1 max-w-sm text-sm text-muted-foreground">
          Introuvable à cet étage. Elle est peut-être en salle de réunion.
        </p>

        <Button asChild className="nf-fade nf-fade-delay-2 mt-8">
          <Link href="/">Retour à l'accueil</Link>
        </Button>
      </div>

      <style>{`
        .nf-enter {
          animation: nf-enter 500ms cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        @keyframes nf-enter {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .nf-digit {
          display: inline-block;
          animation: nf-bounce 2.6s cubic-bezier(0.34, 1.56, 0.26, 1) infinite;
        }
        .nf-digit-1 { animation-delay: 0ms; }
        .nf-digit-2 { animation-delay: 120ms; }
        .nf-digit-3 { animation-delay: 240ms; }
        @keyframes nf-bounce {
          0%, 20% { transform: translateY(0); }
          10% { transform: translateY(-14px); }
          20% { transform: translateY(0); }
          100% { transform: translateY(0); }
        }

        .nf-fade {
          opacity: 0;
          animation: nf-fade-in 400ms cubic-bezier(0.23, 1, 0.32, 1) 220ms both;
        }
        .nf-fade-delay { animation-delay: 280ms; }
        .nf-fade-delay-2 { animation-delay: 340ms; }
        @keyframes nf-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .nf-shape {
          position: absolute;
          border-radius: 9999px;
          background: var(--primary);
          opacity: 0.08;
        }
        .nf-shape-1 {
          top: 12%;
          left: 8%;
          width: 140px;
          height: 140px;
          animation: nf-drift-1 9s ease-in-out infinite;
        }
        .nf-shape-2 {
          bottom: 10%;
          right: 10%;
          width: 200px;
          height: 200px;
          animation: nf-drift-2 11s ease-in-out infinite;
        }
        .nf-shape-3 {
          top: 55%;
          left: 50%;
          width: 90px;
          height: 90px;
          animation: nf-drift-3 7.5s ease-in-out infinite;
        }
        @keyframes nf-drift-1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, 24px); }
        }
        @keyframes nf-drift-2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-24px, -18px); }
        }
        @keyframes nf-drift-3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(16px, -20px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .nf-enter, .nf-digit, .nf-fade, .nf-shape {
            animation: none !important;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </div>
  )
}
