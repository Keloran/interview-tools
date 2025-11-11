import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/interviews/route'
import prisma from '@/lib/prisma'
import { currentUser as mockedCurrentUser } from '@clerk/nextjs/server'

const currentUser = mockedCurrentUser as unknown as ReturnType<typeof vi.fn>

describe('/api/interviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('returns 401 when unauthorized', async () => {
      ;(currentUser as any).mockResolvedValueOnce(null)
      const res = await GET({ url: 'http://localhost/api/interviews' } as any)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ message: 'unauthorized' })
    })

    it('returns empty list when no matches', async () => {
      ;(currentUser as any).mockResolvedValueOnce({ id: 'user_123' })
      ;(prisma.interview.findMany as any).mockResolvedValueOnce([])

      const res = await GET({ url: 'http://localhost/api/interviews?date=2025-11-11' } as any)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
      expect(prisma.interview.findMany).toHaveBeenCalled()
    })
  })

  describe('POST', () => {
    it('creates an interview (happy path)', async () => {
      ;(currentUser as any).mockResolvedValueOnce({ id: 'user_123', emailAddresses: [{ emailAddress: 'a@b.com' }], firstName: 'A', lastName: 'B' })

      ;(prisma.user.upsert as any).mockResolvedValueOnce({ id: 99 })
      ;(prisma.company.upsert as any).mockResolvedValueOnce({ id: 1, name: 'Acme' })
      ;(prisma.stage.upsert as any).mockResolvedValueOnce({ id: 2, stage: 'Phone Screen' })
      ;(prisma.stageMethod.findFirst as any).mockResolvedValueOnce(null)
      ;(prisma.stageMethod.create as any).mockResolvedValueOnce({ id: 10, method: 'Phone' })

      const created = {
        id: 'int_1',
        jobTitle: 'SE',
        interviewer: 'Jane',
        company: { id: 1, name: 'Acme' },
        clientCompany: null,
        stage: { id: 2, stage: 'Phone Screen' },
        stageMethod: { id: 10, method: 'Phone' },
        applicationDate: new Date().toISOString(),
        date: new Date().toISOString(),
        deadline: null,
        outcome: 'SCHEDULED',
        notes: null,
        metadata: { location: 'phone' },
        link: null,
      }
      ;(prisma.interview.create as any).mockResolvedValueOnce(created)

      const body = {
        stage: 'Phone Screen',
        companyName: 'Acme',
        jobTitle: 'SE',
        interviewer: 'Jane',
        locationType: 'phone',
      }

      const req = { json: async () => body } as any
      const res = await POST(req)
      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json.company.name).toBe('Acme')
      expect(prisma.interview.create).toHaveBeenCalled()
    })
  })
})
