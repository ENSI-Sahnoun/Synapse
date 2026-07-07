import Link from 'next/link';
import { createSupabaseClient as createSupabaseServerClient } from '@/supabase-clients/server';
import { ExamModeCard } from './ExamModeCard';
import { ReservationHoldCard } from './ReservationHoldCard';
import { PriorityThresholdCard } from './PriorityThresholdCard';
import { FreeSwapCard } from './FreeSwapCard';
import { DangerZoneSection } from './DangerZoneSection';

export const dynamic = 'force-dynamic';

async function getSetting(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  key: string,
  fallback: string
): Promise<string> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();
  return data?.value ?? fallback;
}

export default async function AdminSettingsPage() {
  const supabase = await createSupabaseServerClient();

  const [examModeValue, holdMinutesValue, priorityDaysValue, freeSwapValue] = await Promise.all([
    getSetting(supabase, 'exam_mode', 'false'),
    getSetting(supabase, 'reservation_hold_minutes', '30'),
    getSetting(supabase, 'priority_min_duration_days', '30'),
    getSetting(supabase, 'free_swap', 'false'),
  ]);

  const examMode = examModeValue === 'true';
  const holdMinutes = parseInt(holdMinutesValue, 10);
  const priorityDays = parseInt(priorityDaysValue, 10);
  const freeSwap = freeSwapValue === 'true';

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configuration globale de l'espace Synapse.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Réservations</h2>
        <ReservationHoldCard initialMinutes={holdMinutes} />
        <ExamModeCard initialEnabled={examMode} />
        <PriorityThresholdCard initialDays={priorityDays} />
        <FreeSwapCard initialEnabled={freeSwap} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <Link
          href="/admin/settings/notifications"
          className="rounded-lg border p-4 hover:bg-muted/50 transition-colors flex items-center justify-between"
        >
          <div>
            <p className="font-medium">Canaux de notification</p>
            <p className="text-sm text-muted-foreground">Configurer les canaux actifs par type de notification</p>
          </div>
          <span className="text-muted-foreground">→</span>
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Classement</h2>
        <Link
          href="/admin/settings/leaderboard"
          className="rounded-lg border p-4 hover:bg-muted/50 transition-colors flex items-center justify-between"
        >
          <div>
            <p className="font-medium">Classement mensuel</p>
            <p className="text-sm text-muted-foreground">Configurer le classement et les récompenses par catégorie</p>
          </div>
          <span className="text-muted-foreground">→</span>
        </Link>
      </section>

      <DangerZoneSection />
    </div>
  );
}
