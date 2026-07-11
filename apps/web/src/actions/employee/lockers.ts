'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'
import { assignLockerSchema, lockerIdSchema } from '@/utils/zod-schemas/locker'
import { getActiveEligibleSubscriptionId } from '@/data/employee/lockers'
import { computeLockerStatus } from '@/lib/locker-status'

export const assignLockerAction = employeeActionClient
  .schema(assignLockerSchema)
  .action(async ({ parsedInput: { locker_id, student_id } }) => {
    const supabase = await createSupabaseClient()

    const subscriptionId = await getActiveEligibleSubscriptionId(student_id)
    if (!subscriptionId) throw new Error("Cet étudiant n'a pas d'abonnement actif d'un mois ou plus.")

    const { data: target, error: targetError } = await supabase
      .from('lockers')
      .select('id, is_unavailable, assigned_student_id, subscriptions:assigned_subscription_id(end_date)')
      .eq('id', locker_id)
      .single()

    if (targetError || !target) throw new Error('Casier introuvable')

    const today = new Date().toISOString().slice(0, 10)
    const endDate = (target.subscriptions as { end_date: string } | null)?.end_date ?? null
    const targetStatus = computeLockerStatus(
      { isUnavailable: target.is_unavailable, assignedStudentId: target.assigned_student_id, subscriptionEndDate: endDate },
      today,
    )

    if (targetStatus === 'occupied' && target.assigned_student_id !== student_id) {
      throw new Error('Ce casier est déjà occupé.')
    }

    // Enforce one locker per student: free any other locker this student currently holds.
    const { error: freeError } = await supabase
      .from('lockers')
      .update({ assigned_student_id: null, assigned_subscription_id: null })
      .eq('assigned_student_id', student_id)
      .neq('id', locker_id)

    if (freeError) throw new Error('Erreur lors de la libération du casier précédent')

    const { error } = await supabase
      .from('lockers')
      .update({ assigned_student_id: student_id, assigned_subscription_id: subscriptionId, is_unavailable: false })
      .eq('id', locker_id)

    if (error) throw new Error("Erreur lors de l'attribution du casier")

    revalidatePath('/employee/lockers')
    return { success: true }
  })

export const unassignLockerAction = employeeActionClient
  .schema(lockerIdSchema)
  .action(async ({ parsedInput: { locker_id } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('lockers')
      .update({ assigned_student_id: null, assigned_subscription_id: null })
      .eq('id', locker_id)
    if (error) throw new Error('Erreur lors de la libération du casier')
    revalidatePath('/employee/lockers')
    return { success: true }
  })

export const markLockerUnavailableAction = employeeActionClient
  .schema(lockerIdSchema)
  .action(async ({ parsedInput: { locker_id } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('lockers')
      .update({ is_unavailable: true, assigned_student_id: null, assigned_subscription_id: null })
      .eq('id', locker_id)
    if (error) throw new Error('Erreur lors de la mise à jour du casier')
    revalidatePath('/employee/lockers')
    return { success: true }
  })

export const markLockerAvailableAction = employeeActionClient
  .schema(lockerIdSchema)
  .action(async ({ parsedInput: { locker_id } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('lockers')
      .update({ is_unavailable: false })
      .eq('id', locker_id)
    if (error) throw new Error('Erreur lors de la mise à jour du casier')
    revalidatePath('/employee/lockers')
    return { success: true }
  })
