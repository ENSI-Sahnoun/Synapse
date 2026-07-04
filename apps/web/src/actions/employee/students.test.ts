import { describe, it, expect, vi } from 'vitest'

// Mock the modules BEFORE importing the action
vi.mock('@/supabase-clients/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}))

vi.mock('@/lib/safe-action', () => ({
  employeeActionClient: {
    use: vi.fn().mockReturnThis(),
    schema: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnThis(),
  },
}))

vi.mock('@/utils/zod-schemas/student', () => ({
  createStudentSchema: { parse: vi.fn() },
  updateStudentSchema: { omit: vi.fn().mockReturnValue({ parse: vi.fn() }) },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('createStudentAction', () => {
  it('should be defined', async () => {
    const { createStudentAction } = await import('./students')
    expect(createStudentAction).toBeDefined()
  })
})
