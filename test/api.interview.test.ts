import {beforeEach, describe, expect, it, vi} from 'vitest'
import {POST} from '@/app/api/interview/route'
import prisma from '@/lib/prisma'
import {currentUser as mockedCurrentUser} from '@clerk/nextjs/server'

const currentUser = mockedCurrentUser as unknown as ReturnType<typeof vi.fn>

describe('/api/interview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST', () => {
    it('creates an interview (happy path)', async () => {
      ;(currentUser as any).mockResolvedValueOnce({
        id: 'user_123',
        emailAddresses: [{emailAddress: 'a@b.com'}],
        firstName: 'A',
        lastName: 'B'
      })

      ;(prisma.user.upsert as any).mockResolvedValueOnce({id: 99})
      ;(prisma.company.upsert as any).mockResolvedValueOnce({id: 1, name: 'Acme'})
      ;(prisma.stage.upsert as any).mockResolvedValueOnce({id: 2, stage: 'Phone Screen'})
      ;(prisma.stageMethod.findFirst as any).mockResolvedValueOnce(null)
      ;(prisma.stageMethod.create as any).mockResolvedValueOnce({id: 10, method: 'Phone'})

      const created = {
          id: 'int_1',
          jobTitle: 'SE',
          interviewer: 'Jane',
          company: {id: 1, name: 'Acme'},
          clientCompany: null,
          stage: {id: 2, stage: 'Phone Screen'},
          stageMethod: {id: 10, method: 'Phone'},
          applicationDate: new Date().toISOString(),
          date: new Date().toISOString(),
          deadline: null,
          outcome: 'SCHEDULED',
          notes: null,
          metadata: {location: 'phone'},
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

      const req = {json: async () => body} as any
      const res = await POST(req)
      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json.company.name).toBe('Acme')
      expect(prisma.interview.create).toHaveBeenCalled()
    })
  })
})
