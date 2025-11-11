import {beforeEach, describe, expect, it, vi} from 'vitest'
import {GET} from '@/app/api/companies/route'

// Mocks come from test/setupTests.ts
import prisma from '@/lib/prisma'
import {currentUser as mockedCurrentUser} from '@clerk/nextjs/server'

const currentUser = mockedCurrentUser as unknown as ReturnType<typeof vi.fn>

describe('GET /api/companies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthorized', async () => {
    ;(currentUser as any).mockResolvedValueOnce(null)

    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toEqual({message: 'Unauthorized'})
  })

  it('returns companies for authorized user', async () => {
    ;(currentUser as any).mockResolvedValueOnce({id: 'user_123'})
    ;(prisma.company.findMany as any).mockResolvedValueOnce([
      {id: 1, name: 'Acme'},
      {id: 2, name: 'Beta'},
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual([
      {id: 1, name: 'Acme'},
      {id: 2, name: 'Beta'},
    ])
    expect(prisma.company.findMany).toHaveBeenCalledWith({
      where: {user: {clerkId: 'user_123'}},
      select: {name: true, id: true},
      orderBy: {name: 'asc'},
    })
  })

  it('handles prisma errors', async () => {
    ;(currentUser as any).mockResolvedValueOnce({id: 'user_123'})
    ;(prisma.company.findMany as any).mockRejectedValueOnce(new Error('boom'))

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json).toEqual({message: 'Failed to fetch companies'})
  })
})
