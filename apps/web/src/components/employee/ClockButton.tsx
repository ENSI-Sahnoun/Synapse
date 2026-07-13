'use client'

import { useAction } from 'next-safe-action/hooks'
import { employeeSelfClockAction } from '@/actions/employee-attendance/clock-action'

export function ClockButton({ isClockedIn }: { isClockedIn: boolean }) {
  const { execute, status, result } = useAction(employeeSelfClockAction)

  const justToggled = result.data?.status === 'EMPLOYEE_CLOCKED_IN' || result.data?.status === 'EMPLOYEE_CLOCKED_OUT'
  const nowIn = justToggled ? result.data?.status === 'EMPLOYEE_CLOCKED_IN' : isClockedIn

  return (
    <button
      onClick={() => execute()}
      disabled={status === 'executing'}
      style={{
        background: nowIn ? 'var(--destructive)' : 'var(--synapse-green-500)',
        color: '#fff',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 20px',
        fontSize: 14,
        fontWeight: 600,
        width: '100%',
      }}
    >
      {nowIn ? 'Pointer départ' : 'Pointer arrivée'}
    </button>
  )
}
