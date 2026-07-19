/**
 * Marketing site constants.
 *
 * TODO(placeholder): every value below is a placeholder — swap for the real
 * Synapse Sfax details before launch. `whatsappNumber` is digits-only in
 * international format (no +, spaces, or leading zeros) for wa.me links.
 */
export const SITE = {
  city: 'Sfax, Tunisie',
  address: 'Avenue Habib Bourguiba, Sfax, Tunisie',
  hours: 'Tous les jours · 8h – minuit',
  email: 'contact@synapse-sfax.tn',
  phone: '+216 00 000 000',
  phoneHref: '+21600000000',
  whatsappNumber: '21600000000',
  instagram: 'https://instagram.com/', // TODO(placeholder)
} as const;

export const waLink = (text?: string) =>
  `https://wa.me/${SITE.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const telLink = () => `tel:${SITE.phoneHref}`;
export const mailLink = (subject?: string) =>
  `mailto:${SITE.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
