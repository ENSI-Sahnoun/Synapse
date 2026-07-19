'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAction } from 'next-safe-action/hooks';
import { motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { Check, Loader2, Send } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { sendContactMessage } from '@/actions/contact/send-message';
import {
  CONTACT_TYPES,
  CONTACT_TYPE_LABELS,
  contactMessageSchema,
  type ContactMessageInput,
} from '@/utils/zod-schemas/contact';
import { EASE_OUT } from '../_lib/motion';

export function ContactForm() {
  const reduce = useReducedMotion();
  const [sent, setSent] = useState(false);

  const form = useForm<ContactMessageInput>({
    resolver: zodResolver(contactMessageSchema),
    defaultValues: { name: '', email: '', phone: '', message: '', company: '' },
  });

  const { execute, isPending } = useAction(sendContactMessage, {
    onSuccess: () => {
      setSent(true);
      form.reset();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Envoi impossible. Réessayez dans un instant.');
    },
  });

  if (sent) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="flex min-h-[26rem] flex-col items-center justify-center rounded-[1.75rem] border border-[var(--synapse-cream-300)] bg-white p-10 text-center shadow-[0_24px_60px_-40px_rgba(80,47,28,0.5)]"
      >
        <motion.span
          initial={reduce ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.6, bounce: 0.35, delay: 0.05 }}
          className="mb-6 flex size-16 items-center justify-center rounded-full bg-[var(--synapse-green-500)] text-white"
        >
          <Check className="size-8" strokeWidth={2.5} />
        </motion.span>
        <h3
          className="text-2xl font-normal text-[var(--synapse-stone-900)]"
          style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
        >
          Message envoyé
        </h3>
        <p className="mt-2 max-w-sm text-pretty text-[var(--synapse-stone-600)]">
          Merci de nous avoir écrit. Notre équipe vous répond très vite, en général sous 24 heures.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-6 text-sm font-semibold text-[var(--synapse-brown-700)] underline-offset-4 hover:underline"
        >
          Envoyer un autre message
        </button>
      </motion.div>
    );
  }

  return (
    <div className="rounded-[1.75rem] border border-[var(--synapse-cream-300)] bg-white p-6 shadow-[0_24px_60px_-40px_rgba(80,47,28,0.5)] sm:p-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => execute(v))} className="space-y-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Votre nom" autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="vous@exemple.com" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Téléphone <span className="font-normal text-[var(--synapse-stone-400)]">(facultatif)</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+216 …" autoComplete="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vous êtes</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choisir un profil" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CONTACT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {CONTACT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <Textarea
                    rows={5}
                    placeholder="Parlez-nous de votre rythme de travail et de ce que vous recherchez…"
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Honeypot — hidden from users, catches bots. */}
          <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden" tabIndex={-1}>
            <label htmlFor="company">Société</label>
            <input
              id="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...form.register('company')}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--synapse-stone-900)] px-6 py-3.5 text-base font-semibold text-white transition-[transform,background-color,opacity] duration-200 hover:bg-[var(--synapse-stone-800)] active:scale-[0.98] disabled:opacity-60 motion-reduce:active:scale-100 sm:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4.5 animate-spin" />
                Envoi…
              </>
            ) : (
              <>
                Envoyer le message
                <Send className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </>
            )}
          </button>
        </form>
      </Form>
    </div>
  );
}
