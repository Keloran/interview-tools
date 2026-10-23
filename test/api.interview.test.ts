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
          id: 1,
          interviewer: 'Jane',
          stage: {id: 2, stage: 'Phone Screen'},
          stageMethod: {id: 10, method: 'Phone'},
          date: new Date().toISOString(),
          deadline: null,
          outcome: 'SCHEDULED',
          notes: null,
          link: null,
          application: {
            id: 5,
            jobTitle: 'SE',
            clientCompany: null,
            applicationDate: new Date().toISOString(),
            jobPostingLink: null,
            company: {id: 1, name: 'Acme'},
          },
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
      expect(json.jobTitle).toBe('SE')
      const data = (prisma.interview.create as any).mock.calls[0][0].data
      expect(data.application.create).toMatchObject({userId: 99, companyId: 1, jobTitle: 'SE'})
    })

    it('adds the next stage to the previous stage\'s application', async () => {
      ;(currentUser as any).mockResolvedValueOnce({id: 'user_123', emailAddresses: []})
      ;(prisma.user.upsert as any).mockResolvedValueOnce({id: 99})
      ;(prisma.company.upsert as any).mockResolvedValueOnce({id: 1, name: 'Acme'})
      ;(prisma.stage.upsert as any).mockResolvedValueOnce({id: 3, stage: 'Technical'})
      ;(prisma.stageMethod.findFirst as any).mockResolvedValueOnce({id: 10, method: 'Phone'})
      ;(prisma.interview.findFirst as any).mockResolvedValueOnce({id: 7, applicationId: 5})
      ;(prisma.interview.create as any).mockResolvedValueOnce({
        id: 8, stage: {id: 3, stage: 'Technical'},
        application: {id: 5, jobTitle: 'SE', clientCompany: null, applicationDate: new Date().toISOString(), jobPostingLink: 'http://job', company: {id: 1, name: 'Acme'}},
      })

      const body = {stage: 'Technical', companyName: 'Acme', jobTitle: 'SE', previousInterviewId: '7'}
      const res = await POST({json: async () => body} as any)
      expect(res.status).toBe(201)
      expect((await res.json()).metadata).toEqual({jobListing: 'http://job'})

      // ownership is checked against the signed-in user's applications
      expect((prisma.interview.findFirst as any).mock.calls[0][0].where).toEqual({id: 7, application: {userId: 99}})
      const data = (prisma.interview.create as any).mock.calls[0][0].data
      expect(data.application).toEqual({connect: {id: 5}})
      expect(data.parent).toEqual({connect: {id: 7}})
    })
  })
})
