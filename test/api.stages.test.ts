import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/stages/route'
import prisma from '@/lib/prisma'
import { currentUser as mockedCurrentUser } from '@clerk/nextjs/server'

const currentUser = mockedCurrentUser as unknown as ReturnType<typeof vi.fn>

describe('GET /api/stages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthorized', async () => {
    ;(currentUser as any).mockResolvedValueOnce(null)

    // @ts-expect-error request not used
    const res = await GET({})
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ message: 'unauthorized' })
  })

  it('returns stages when authorized', async () => {
    ;(currentUser as any).mockResolvedValueOnce({ id: 'user_123' })
    ;(prisma.stage.findMany as any).mockResolvedValueOnce([
      { id: 1, stage: 'Applied' },
      { id: 2, stage: 'Phone Screen' },
    ])

    // @ts-expect-error request not used
    const res = await GET({})
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      { id: 1, stage: 'Applied' },
      { id: 2, stage: 'Phone Screen' },
    ])
  })

  it('handles prisma errors', async () => {
    ;(currentUser as any).mockResolvedValueOnce({ id: 'user_123' })
    ;(prisma.stage.findMany as any).mockRejectedValueOnce(new Error('boom'))

    // @ts-expect-error request not used
    const res = await GET({})
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ message: 'Internal Server Error' })
  })
})
