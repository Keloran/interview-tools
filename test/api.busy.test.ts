import {beforeEach, describe, expect, it, vi} from 'vitest'
import {currentUser as mockedCurrentUser} from '@clerk/nextjs/server'

vi.mock('@/lib/externalBusy', () => ({externalBusy: vi.fn(async () => [{start: new Date('2026-10-29T15:00:00Z'), durationMinutes: 60}])}))

import {GET} from '@/app/api/busy/route'
import {externalBusy} from '@/lib/externalBusy'

const currentUser = mockedCurrentUser as unknown as ReturnType<typeof vi.fn>
const req = (from: string, to: string) => ({nextUrl: new URL(`http://x/api/busy?from=${from}&to=${to}`)}) as any

describe('GET /api/busy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('needs you signed in', async () => {
    currentUser.mockResolvedValueOnce(null)
    expect((await GET(req('2026-10-29T00:00:00Z', '2026-10-30T00:00:00Z'))).status).toBe(401)
  })

  it('refuses a missing, backwards or too long range', async () => {
    expect((await GET(req('nope', '2026-10-30T00:00:00Z'))).status).toBe(400)
    expect((await GET(req('2026-10-30T00:00:00Z', '2026-10-29T00:00:00Z'))).status).toBe(400)
    expect((await GET(req('2026-10-01T00:00:00Z', '2026-10-20T00:00:00Z'))).status).toBe(400)
    expect(externalBusy).not.toHaveBeenCalled()
  })

  it("returns your calendar's busy times", async () => {
    const res = await GET(req('2026-10-29T00:00:00Z', '2026-10-30T00:00:00Z'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{start: '2026-10-29T15:00:00.000Z', durationMinutes: 60}])
    expect(externalBusy).toHaveBeenCalledWith('user_123', new Date('2026-10-29T00:00:00Z'), new Date('2026-10-30T00:00:00Z'))
  })
})
