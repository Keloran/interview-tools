import {beforeEach, describe, expect, it, vi} from 'vitest'
import {GET, POST} from '@/app/api/follow-ups/route'
import prisma from '@/lib/prisma'

const DAY = 864e5
const app = (id: number, latest: object, followUps: Date[] = []) => ({
  id, jobTitle: 'SE', clientCompany: null, applicationDate: new Date(Date.now() - 20 * DAY), company: {name: 'Acme'},
  interviews: [{outcome: 'AWAITING_RESPONSE', date: null, replyBy: null, interviewer: null, nextStep: null, stage: {stage: 'Applied'}, ...latest}],
  followUps: followUps.map((sentAt) => ({sentAt})),
})

describe('/api/follow-ups', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET lists only applications due a follow-up, longest overdue first', async () => {
    ;(prisma.application.findMany as any).mockResolvedValueOnce([
      app(1, {}), // applied 20 days ago: due since day 10
      app(2, {}, [new Date(Date.now() - 2 * DAY)]), // chased 2 days ago: not yet
      app(3, {outcome: 'REJECTED'}), // settled
      app(4, {stage: {stage: 'Technical'}, date: new Date(Date.now() - 12 * DAY)}), // due since 7 days ago
    ])
    const res = await GET()
    const body = await res.json()
    expect(body.map((a: { id: number }) => a.id)).toEqual([1, 4])
    expect(body[0]).toMatchObject({company: 'Acme', stage: 'Applied', followUps: 0})
  })

  it('POST logs a follow-up on your own application only', async () => {
    const post = (applicationId: unknown) => POST(new Request('http://x/api/follow-ups', {method: 'POST', body: JSON.stringify({applicationId})}) as any)

    ;(prisma.application.findFirst as any).mockResolvedValueOnce(null)
    expect((await post(5)).status).toBe(404)
    expect(prisma.followUp.create).not.toHaveBeenCalled()

    ;(prisma.application.findFirst as any).mockResolvedValueOnce({id: 5})
    ;(prisma.followUp.create as any).mockResolvedValueOnce({id: 1, sentAt: new Date()})
    expect((await post(5)).status).toBe(201)
    expect(prisma.followUp.create).toHaveBeenCalledWith(expect.objectContaining({data: {applicationId: 5}}))

    expect((await post('5')).status).toBe(400)
  })
})
