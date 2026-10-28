import {beforeEach, describe, expect, it, vi} from 'vitest'
import {POST} from '@/app/api/check/route'
import {GET as getRecruiters} from '@/app/api/recruiters/route'
import prisma from '@/lib/prisma'
import {currentUser as mockedCurrentUser} from '@clerk/nextjs/server'

const currentUser = mockedCurrentUser as unknown as ReturnType<typeof vi.fn>
const post = (body: unknown) => POST({json: async () => body} as any)

// Recruit Co put you forward for Acme twice and never replied; Beta is a direct employer
const history = [
  {id: 1, name: 'Recruit Co', applications: [1, 2].map((id) => ({
    id, jobTitle: 'Senior iOS Engineer', clientCompany: 'Acme', communityEmployerId: null, communityEmployerConfirmedAt: null, communityEmployerIdentity: null, communityEmployer: null,
    applicationDate: '2025-01-01T00:00:00.000Z', jobPostingLink: id === 1 ? 'https://jobs.example.com/123' : null,
    recruiterName: 'Sam', recruiterEmail: 'sam@recruit.co', recruiterLinkedIn: null, viaRecruiter: true,
    interviews: [{outcome: 'NO_RESPONSE', updated_at: '2025-03-01T00:00:00.000Z', created_at: '2025-01-01T00:00:00.000Z', replyBy: null, stage: {stage: 'Applied'}}],
    _count: {followUps: 0},
  }))},
  {id: 2, name: 'Beta', applications: []},
]

describe('POST /api/check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthorized', async () => {
    ;(currentUser as any).mockResolvedValueOnce(null)
    expect((await post({})).status).toBe(401)
  })

  it('rejects a malformed body', async () => {
    ;(currentUser as any).mockResolvedValueOnce({id: 'user_123'})
    expect((await post({title: 42})).status).toBe(400)
  })

  it('finds previous applications through the end client, and flags them from the description', async () => {
    ;(currentUser as any).mockResolvedValueOnce({id: 'user_123'})
    ;(prisma.company.findMany as any).mockResolvedValueOnce(history)

    const res = await post({company: 'Acme', title: 'Senior iOS Engineer', description: 'Join our team building apps. Unpaid take-home test.'})
    expect(res.status).toBe(200)
    const {matches, flags} = await res.json()
    expect(matches.map((m: any) => m.id)).toEqual([1, 2])
    expect(matches[0]).toMatchObject({companyName: 'Recruit Co', sameTitle: true, response: 'ghosted'})
    const ids = flags.map((f: any) => f.id)
    expect(ids).toContain('already-applied')
    expect(ids).toContain('ghosted')
    expect((prisma.company.findMany as any).mock.calls[0][0].where).toEqual({user: {clerkId: 'user_123'}})
  })

  it('matches the job link, and skips listing checks without a description', async () => {
    ;(currentUser as any).mockResolvedValueOnce({id: 'user_123'})
    ;(prisma.company.findMany as any).mockResolvedValueOnce(history)

    const {matches, flags} = await (await post({link: 'https://jobs.example.com/123'})).json()
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({id: 1, samePosting: true})
    expect(flags).toEqual([])
  })

  it('handles prisma errors', async () => {
    ;(currentUser as any).mockResolvedValueOnce({id: 'user_123'})
    ;(prisma.company.findMany as any).mockRejectedValueOnce(new Error('boom'))
    expect((await post({company: 'Acme'})).status).toBe(500)
  })
})

describe('GET /api/recruiters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthorized', async () => {
    ;(currentUser as any).mockResolvedValueOnce(null)
    expect((await getRecruiters()).status).toBe(401)
  })

  it('returns the agency and its recruiter with their record', async () => {
    ;(currentUser as any).mockResolvedValueOnce({id: 'user_123'})
    ;(prisma.company.findMany as any).mockResolvedValueOnce(history)

    const records = await (await getRecruiters()).json()
    expect(records.map((r: any) => [r.agency, r.contact?.recruiterName ?? null])).toEqual([['Recruit Co', null], ['Recruit Co', 'Sam']])
    expect(records[0].stats).toMatchObject({roles: 2, ghosted: 2, ghostRate: 100})
  })
})
