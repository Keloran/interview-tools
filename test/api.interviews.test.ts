import {beforeEach, describe, expect, it, vi} from 'vitest'
import {GET} from '@/app/api/interviews/route'
import prisma from '@/lib/prisma'
import {currentUser as mockedCurrentUser} from '@clerk/nextjs/server'

const currentUser = mockedCurrentUser as unknown as ReturnType<typeof vi.fn>

describe('/api/interviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('returns 401 when unauthorized', async () => {
      ;(currentUser as any).mockResolvedValueOnce(null)
      const res = await GET({url: 'http://localhost/api/interviews'} as any)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({message: 'unauthorized'})
    })

    it('returns empty list when no matches', async () => {
      ;(currentUser as any).mockResolvedValueOnce({id: 'user_123'})
      ;(prisma.interview.findMany as any).mockResolvedValueOnce([])

      const res = await GET({url: 'http://localhost/api/interviews?date=2025-11-11'} as any)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
      expect(prisma.interview.findMany).toHaveBeenCalled()
    })
  })
})
