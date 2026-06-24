import { getLoggedInUserId, getLoggedInUserProfile } from '@/data/user/user'
import { createSafeActionClient } from 'next-safe-action'
import 'server-only'

export const actionClient = createSafeActionClient({
  handleServerError: (e) => e.message,
}).use(
  async ({ next, clientInput, metadata }) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('LOGGING MIDDLEWARE')
      const startTime = performance.now()
      const result = await next()
      const endTime = performance.now()
      console.log('Result ->', result)
      console.log('Client input ->', clientInput)
      console.log('Metadata ->', metadata)
      console.log('Action execution took', endTime - startTime, 'ms')
      return result
    }
    return await next()
  }
)

export const authActionClient = actionClient.use(async ({ next }) => {
  const userId = await getLoggedInUserId()
  return await next({ ctx: { userId } })
})

export const adminActionClient = actionClient.use(async ({ next }) => {
  const profile = await getLoggedInUserProfile()
  if (profile.role !== 'admin') {
    throw new Error('Accès refusé: droits administrateur requis')
  }
  return await next({ ctx: { userId: profile.id, role: profile.role } })
})

export const employeeActionClient = actionClient.use(async ({ next }) => {
  const profile = await getLoggedInUserProfile()
  if (profile.role !== 'admin' && profile.role !== 'employee') {
    throw new Error('Accès refusé: droits employé requis')
  }
  return await next({ ctx: { userId: profile.id, role: profile.role } })
})

export const studentActionClient = actionClient.use(async ({ next }) => {
  const profile = await getLoggedInUserProfile()
  if (profile.role !== 'student') {
    throw new Error('Accès refusé')
  }
  return await next({ ctx: { userId: profile.id, role: profile.role } })
})
