import {beforeEach, describe, expect, it, vi} from 'vitest'
import {POST as create} from '@/app/api/availability/route'
import {POST as book} from '@/app/api/availability/[id]/route'
import {POST as view} from '@/app/api/availability/[id]/view/route'
import prisma from '@/lib/prisma'
import {currentUser as mockedCurrentUser} from '@clerk/nextjs/server'
import {externalBusyAroundSlots as mockedCalendar} from '@/lib/externalBusy'

vi.mock('@/lib/externalBusy', () => ({externalBusyAroundSlots: vi.fn(async () => [])}))
const calendar = mockedCalendar as unknown as ReturnType<typeof vi.fn>

const currentUser = mockedCurrentUser as unknown as ReturnType<typeof vi.fn>
const p = prisma as any
const tomorrow = new Date(Date.now() + 864e5)
const req = (body: unknown) => ({json: async () => body}) as any

describe('/api/availability', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects past slots', async () => {
    currentUser.mockResolvedValueOnce({id: 'user_123'})
    const res = await create(req({interviewId: 1, stage: 'Technical', slots: ['2020-01-01T10:00:00Z']}))
    expect(res.status).toBe(400)
  })

  it("won't create a link for someone else's interview", async () => {
    currentUser.mockResolvedValueOnce({id: 'user_123'})
    p.interview.findFirst.mockResolvedValueOnce(null)
    const res = await create(req({interviewId: 1, stage: 'Technical', slots: [tomorrow.toISOString()]}))
    expect(res.status).toBe(404)
    expect(p.interview.findFirst.mock.calls[0][0].where).toEqual({id: 1, application: {user: {clerkId: 'user_123'}}})
  })

  it('creates a link on the application', async () => {
    currentUser.mockResolvedValueOnce({id: 'user_123'})
    p.interview.findFirst.mockResolvedValueOnce({applicationId: 5})
    p.stage.upsert.mockResolvedValueOnce({id: 9})
    p.availabilityLink.create.mockResolvedValueOnce({id: 'abc'})
    const res = await create(req({interviewId: 1, stage: 'Technical', durationMinutes: 45, slots: [tomorrow.toISOString()]}))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({id: 'abc', path: '/availability/abc'})
    expect(p.availabilityLink.create.mock.calls[0][0].data).toMatchObject({applicationId: 5, stageId: 9, durationMinutes: 45})
  })
})

describe('/api/availability/[id] booking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    p.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma))
  })
  const params = {params: Promise.resolve({id: 'abc'})}
  const link = (overrides = {}) => ({
    slots: [tomorrow], durationMinutes: 60, meetingLink: null, stageId: 9, bookedSlot: null,
    application: {id: 5, userId: 1, interviews: [], user: {clerkId: 'user_123'}}, ...overrides,
  })

  it('only accepts offered times', async () => {
    p.availabilityLink.findUnique.mockResolvedValue(link())
    const res = await book(req({slot: new Date(tomorrow.getTime() + 60e3).toISOString()}), params)
    expect(res.status).toBe(400)
  })

  it('refuses a link that is already booked', async () => {
    p.availabilityLink.findUnique.mockResolvedValue(link({bookedSlot: tomorrow}))
    const res = await book(req({slot: tomorrow.toISOString()}), params)
    expect(res.status).toBe(409)
    expect(p.interview.create).not.toHaveBeenCalled()
  })

  it("refuses a time that's busy in the owner's Google Calendar", async () => {
    p.availabilityLink.findUnique.mockResolvedValue(link())
    p.interview.findMany.mockResolvedValueOnce([])
    calendar.mockResolvedValueOnce([{start: new Date(tomorrow.getTime() + 30 * 60e3), durationMinutes: 60}])
    const res = await book(req({slot: tomorrow.toISOString()}), params)
    expect(res.status).toBe(409)
    expect(calendar).toHaveBeenCalledWith('user_123', [tomorrow])
    expect(p.availabilityLink.updateMany).not.toHaveBeenCalled()
  })
})

describe('/api/availability/[id] booking race', () => {
  it('reports a losing concurrent booking as already booked, not a server error', async () => {
    const p = prisma as any
    p.$transaction.mockRejectedValueOnce(new Error('something odd from the driver'))
    p.availabilityLink.findUnique.mockResolvedValue({bookedSlot: new Date(), slots: [], application: {user: {clerkId: 'user_123'}}})
    const res = await book({json: async () => ({slot: new Date().toISOString()})} as any, {params: Promise.resolve({id: 'abc'})})
    expect(res.status).toBe(409)
  })
})

describe('/api/availability/[id]/view', () => {
  beforeEach(() => vi.clearAllMocks())
  const ctx = {params: Promise.resolve({id: 'link1'})}

  it("doesn't count the owner's own view", async () => {
    currentUser.mockResolvedValueOnce({id: 'user_123'})
    p.availabilityLink.findFirst.mockResolvedValueOnce({id: 'link1'})
    const res = await view({} as any, ctx)
    expect(res.status).toBe(204)
    expect(p.availabilityLink.findFirst.mock.calls[0][0].where).toEqual({id: 'link1', application: {user: {clerkId: 'user_123'}}})
    expect(p.availabilityLink.updateMany).not.toHaveBeenCalled()
  })

  it('counts an anonymous visitor', async () => {
    currentUser.mockResolvedValueOnce(null)
    p.availabilityLink.updateMany.mockResolvedValue({count: 1})
    const res = await view({} as any, ctx)
    expect(res.status).toBe(204)
    expect(p.availabilityLink.findFirst).not.toHaveBeenCalled()
    expect(p.availabilityLink.updateMany.mock.calls[0][0].data.viewCount).toEqual({increment: 1})
  })

  it("counts a signed-in visitor who isn't the owner", async () => {
    currentUser.mockResolvedValueOnce({id: 'someone_else'})
    p.availabilityLink.findFirst.mockResolvedValueOnce(null)
    p.availabilityLink.updateMany.mockResolvedValue({count: 1})
    const res = await view({} as any, ctx)
    expect(res.status).toBe(204)
    expect(p.availabilityLink.updateMany).toHaveBeenCalled()
  })
})
