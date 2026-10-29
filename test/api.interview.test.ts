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

    it.each([0, -1, 'bad-id', ''])('rejects invalid parent %s before creating anything', async (previousInterviewId) => {
      currentUser.mockResolvedValueOnce({id: 'user_123', emailAddresses: []})
      const res = await POST({json: async () => ({stage: 'Phone Screen', companyName: 'Acme', jobTitle: 'SE', previousInterviewId})} as any)
      expect(res.status).toBe(400)
      expect(prisma.interview.create).not.toHaveBeenCalled()
    })

    it('does not fork an application when the requested parent is missing or unowned', async () => {
      currentUser.mockResolvedValueOnce({id: 'user_123', emailAddresses: []})
      ;(prisma.user.upsert as any).mockResolvedValueOnce({id: 99})
      ;(prisma.interview.findFirst as any).mockResolvedValueOnce(null)
      const res = await POST({json: async () => ({stage: 'Technical', companyName: 'Acme', jobTitle: 'SE', previousInterviewId: 7})} as any)
      expect(res.status).toBe(404)
      expect(prisma.interview.create).not.toHaveBeenCalled()
      expect(prisma.company.upsert).not.toHaveBeenCalled()
    })

    it('preserves an explicitly selected meeting method instead of inferring another one', async () => {
      currentUser.mockResolvedValueOnce({id: 'user_123', emailAddresses: []})
      ;(prisma.user.upsert as any).mockResolvedValueOnce({id: 99})
      ;(prisma.stageMethod.findFirst as any).mockResolvedValueOnce({id: 20, method: 'Teams'})
      ;(prisma.company.upsert as any).mockResolvedValueOnce({id: 1, name: 'Acme'})
      ;(prisma.stage.upsert as any).mockResolvedValueOnce({id: 2, stage: 'Phone Screen'})
      ;(prisma.interview.create as any).mockResolvedValueOnce({id: 1, application: {id: 5, jobTitle: 'SE', applicationDate: new Date(), company: {id: 1, name: 'Acme'}}})
      const res = await POST({json: async () => ({stage: 'Phone Screen', companyName: 'Acme', jobTitle: 'SE', stageMethodId: 20, durationMinutes: 45})} as any)
      expect(res.status).toBe(201)
      expect(prisma.stageMethod.findFirst).toHaveBeenCalledWith({where: {id: 20}, select: {id: true, method: true}})
      const data = (prisma.interview.create as any).mock.calls[0][0].data
      expect(data.stageMethod).toEqual({connect: {id: 20}})
      expect(data.durationMinutes).toBe(45)
      expect(prisma.stageMethod.create).not.toHaveBeenCalled()
    })

    it('rejects a selected meeting method that no longer exists', async () => {
      currentUser.mockResolvedValueOnce({id: 'user_123', emailAddresses: []})
      ;(prisma.user.upsert as any).mockResolvedValueOnce({id: 99})
      ;(prisma.stageMethod.findFirst as any).mockResolvedValueOnce(null)
      const res = await POST({json: async () => ({stage: 'Phone Screen', companyName: 'Acme', jobTitle: 'SE', stageMethodId: 999})} as any)
      expect(res.status).toBe(404)
      expect(prisma.interview.create).not.toHaveBeenCalled()
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

describe('PUT /api/interview/[id] debrief', () => {
  it('saves a partly filled debrief and stamps when it was done', async () => {
    const {PUT} = await import('@/app/api/interview/[id]/route')
    ;(prisma.interview.findFirst as any).mockResolvedValueOnce({id: 7})
    ;(prisma.interview.update as any).mockResolvedValueOnce({
      id: 7, stage: {id: 1, stage: 'Technical'}, application: {id: 1, jobTitle: 'SE', clientCompany: null, applicationDate: new Date(), jobPostingLink: null, company: {id: 1, name: 'Acme'}},
    })

    const req = new Request('http://localhost/api/interview/7', {
      method: 'PUT',
      body: JSON.stringify({debrief: {rating: 5, nextStep: 'Final round', replyBy: '2026-11-06T00:00:00.000Z'}}),
    })
    const res = await PUT(req as any, {params: Promise.resolve({id: '7'})})

    expect(res.status).toBe(200)
    const {data} = (prisma.interview.update as any).mock.calls[0][0]
    expect(data).toMatchObject({rating: 5, nextStep: 'Final round', replyBy: new Date('2026-11-06T00:00:00.000Z'), questionsAsked: null})
    expect(data.debriefedAt).toBeInstanceOf(Date)
    expect(data).not.toHaveProperty('prepNotes') // a partial debrief must not erase separately saved preparation
  })
})

describe('PUT /api/interview/[id] feedback', () => {
  it('saves feedback alongside a rejection', async () => {
    const {PUT} = await import('@/app/api/interview/[id]/route')
    ;(prisma.interview.findFirst as any).mockResolvedValueOnce({id: 7})
    ;(prisma.interview.update as any).mockResolvedValueOnce({
      id: 7, stage: {id: 1, stage: 'Technical'}, application: {id: 1, jobTitle: 'SE', clientCompany: null, applicationDate: new Date(), jobPostingLink: null, company: {id: 1, name: 'Acme'}},
    })
    const req = new Request('http://localhost/api/interview/7', {
      method: 'PUT',
      body: JSON.stringify({outcome: 'REJECTED', feedback: {type: 'SPECIFIC', text: 'More system design'}}),
    })
    expect((await PUT(req as any, {params: Promise.resolve({id: '7'})})).status).toBe(200)
    const {data} = (prisma.interview.update as any).mock.calls.at(-1)[0]
    expect(data).toMatchObject({outcome: 'REJECTED', feedbackType: 'SPECIFIC', feedbackText: 'More system design'})
  })
})

describe('PUT /api/interview/[id] application fields', () => {
  const row = {id: 7, stage: {id: 1, stage: 'Technical'}, application: {id: 1, jobTitle: 'SE', clientCompany: null, applicationDate: new Date(), jobPostingLink: null, company: {id: 1, name: 'Acme'}}}
  const put = async (body: unknown) => {
    const {PUT} = await import('@/app/api/interview/[id]/route')
    const req = new Request('http://localhost/api/interview/7', {method: 'PUT', body: JSON.stringify(body)})
    return PUT(req as any, {params: Promise.resolve({id: '7'})})
  }

  it('renames the application and clears the date (the iOS edit screen does both)', async () => {
    ;(prisma.interview.findFirst as any).mockResolvedValueOnce({id: 7})
    ;(prisma.interview.update as any).mockResolvedValueOnce(row)
    expect((await put({jobTitle: '  Senior SE ', date: null})).status).toBe(200)
    const {data} = (prisma.interview.update as any).mock.calls.at(-1)[0]
    expect(data.date).toBeNull()
    expect(data.application).toEqual({update: {jobTitle: 'Senior SE'}})
  })

  it('ignores a blank title rather than erasing it', async () => {
    ;(prisma.interview.findFirst as any).mockResolvedValueOnce({id: 7})
    ;(prisma.interview.update as any).mockResolvedValueOnce(row)
    await put({jobTitle: '   '})
    const {data} = (prisma.interview.update as any).mock.calls.at(-1)[0]
    expect(data).not.toHaveProperty('application')
  })

  it('returns 409 when the new title clashes with another application', async () => {
    const {Prisma} = await import('@/app/generated/prisma/client')
    ;(prisma.interview.findFirst as any).mockResolvedValueOnce({id: 7})
    ;(prisma.interview.update as any).mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {code: 'P2002', clientVersion: 'test'}))
    const res = await put({jobTitle: 'Existing'})
    expect(res.status).toBe(409)
  })
})

describe('native create idempotency', () => {
  const mutation = '11111111-1111-4111-8111-111111111111'
  const body = {stage: 'Phone Screen', companyName: 'Acme', jobTitle: 'SE', clientMutationId: mutation}
  const existing = {id: 7, application: {id: 5, jobTitle: 'SE', applicationDate: new Date(), company: {id: 1, name: 'Acme'}}}
  beforeEach(() => { vi.clearAllMocks(); currentUser.mockResolvedValueOnce({id: 'user_123', emailAddresses: []}); (prisma.user.upsert as any).mockResolvedValueOnce({id: 99}) })

  it('returns the acknowledged record when a lost response is retried', async () => {
    ;(prisma.interviewCreateReceipt.findUnique as any).mockResolvedValueOnce({interview: existing})
    const response = await POST({json: async () => body} as any)
    expect(response.status).toBe(200)
    expect((await response.json()).id).toBe(7)
    expect(prisma.interviewCreateReceipt.findUnique).toHaveBeenCalledWith(expect.objectContaining({where: {userId_mutationId: {userId: 99, mutationId: mutation}}}))
    expect(prisma.interview.create).not.toHaveBeenCalled()
    expect(prisma.company.upsert).not.toHaveBeenCalled()
  })

  it('stores an owner-scoped identity on a new record', async () => {
    ;(prisma.interviewCreateReceipt.findUnique as any).mockResolvedValueOnce(null)
    ;(prisma.company.upsert as any).mockResolvedValueOnce({id: 1})
    ;(prisma.stage.upsert as any).mockResolvedValueOnce({id: 2})
    ;(prisma.stageMethod.findFirst as any).mockResolvedValueOnce({id: 3})
    ;(prisma.interview.create as any).mockResolvedValueOnce(existing)
    expect((await POST({json: async () => body} as any)).status).toBe(201)
    expect((prisma.interview.create as any).mock.calls[0][0].data.createReceipt).toEqual({create: {userId: 99, mutationId: mutation}})
  })

  it('recovers a concurrent retry that loses the unique-key race', async () => {
    const {Prisma} = await import('@/app/generated/prisma/client')
    ;(prisma.interviewCreateReceipt.findUnique as any).mockResolvedValueOnce(null).mockResolvedValueOnce({interview: existing})
    ;(prisma.company.upsert as any).mockResolvedValueOnce({id: 1})
    ;(prisma.stage.upsert as any).mockResolvedValueOnce({id: 2})
    ;(prisma.stageMethod.findFirst as any).mockResolvedValueOnce({id: 3})
    ;(prisma.interview.create as any).mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('duplicate mutation', {code: 'P2002', clientVersion: 'test'}))
    const response = await POST({json: async () => body} as any)
    expect(response.status).toBe(200)
    expect((await response.json()).id).toBe(7)
    expect((prisma.interviewCreateReceipt.findUnique as any).mock.calls.at(-1)[0].where.userId_mutationId.userId).toBe(99)
  })

  it('namespaces another account separately even when the client UUID is identical', async () => {
    ;(prisma.user.upsert as any).mockReset().mockResolvedValueOnce({id: 100})
    ;(prisma.interviewCreateReceipt.findUnique as any).mockResolvedValueOnce({interview: existing})
    await POST({json: async () => body} as any)
    expect((prisma.interviewCreateReceipt.findUnique as any).mock.calls[0][0].where).toEqual({userId_mutationId: {userId: 100, mutationId: mutation}})
  })

  it('retains a tombstone after deletion so delayed retries do not resurrect the interview', async () => {
    ;(prisma.interviewCreateReceipt.findUnique as any).mockResolvedValueOnce({interview: null})
    const response = await POST({json: async () => body} as any)
    expect(response.status).toBe(410)
    expect(prisma.interview.create).not.toHaveBeenCalled()
  })

  it('rejects malformed identities without creating records', async () => {
    expect((await POST({json: async () => ({...body, clientMutationId: 'not-a-uuid'})} as any)).status).toBe(400)
    expect(prisma.interview.create).not.toHaveBeenCalled()
  })
})

describe('native queued editable fields', () => {
  it('updates the owned application company and explicit stage/method selections', async () => {
    const {PUT} = await import('@/app/api/interview/[id]/route')
    currentUser.mockResolvedValueOnce({id: 'user_123'})
    ;(prisma.interview.findFirst as any).mockResolvedValueOnce({id: 7, application: {userId: 99}, stage: {stage: 'Phone Screen'}})
    ;(prisma.company.upsert as any).mockResolvedValueOnce({id: 20})
    ;(prisma.stage.upsert as any).mockResolvedValueOnce({id: 30})
    ;(prisma.stageMethod.upsert as any).mockResolvedValueOnce({id: 40})
    ;(prisma.interview.update as any).mockResolvedValueOnce({id: 7, application: {id: 5, jobTitle: 'SE', applicationDate: new Date(), company: {id: 20, name: 'New company'}}})
    const req = new Request('http://localhost/api/interview/7', {method: 'PUT', body: JSON.stringify({companyName: 'New company', stageName: 'Second Stage', stageMethodName: 'Phone', notes: '', link: null})})
    const response = await PUT(req as any, {params: Promise.resolve({id: '7'})})
    expect(response.status).toBe(200)
    expect((prisma.company.upsert as any).mock.calls.at(-1)[0].where.userId_name.userId).toBe(99)
    const data = (prisma.interview.update as any).mock.calls.at(-1)[0].data
    expect(data).toMatchObject({application: {update: {company: {connect: {id: 20}}}}, stage: {connect: {id: 30}}, stageMethod: {connect: {id: 40}}, notes: '', link: null})
  })
})
