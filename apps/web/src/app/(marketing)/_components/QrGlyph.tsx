'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * A real, scannable QR code (not a decorative pixel grid) encoding the given
 * value. Rendered client-side via the same `qrcode` lib the student check-in
 * flow uses. Returns null until the data URL is ready so we never flash a
 * broken image.
 */
export function QrGlyph({
  value,
  size = 128,
  dark = 'var(--synapse-stone-900)',
  className,
}: {
  value: string;
  size?: number;
  dark?: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 0,
      color: { dark: resolveColor(dark), light: '#00000000' },
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size, dark]);

  if (!src) return <div className={className} style={{ width: size, height: size }} aria-hidden />;

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} className={className} draggable={false} />;
}

// qrcode's color option needs a resolved hex, not a CSS var — resolve against
// the document when available, else fall back to ink.
function resolveColor(value: string): string {
  if (!value.startsWith('var(') || typeof window === 'undefined') return value.startsWith('var(') ? '#1E1812' : value;
  const name = value.slice(4, -1).trim();
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return resolved || '#1E1812';
}
