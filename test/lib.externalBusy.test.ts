import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const getUserOauthAccessToken = vi.fn()
vi.mock('@clerk/nextjs/server', () => ({clerkClient: async () => ({users: {getUserOauthAccessToken}})}))
vi.mock('@clerk/nextjs/errors', () => ({isClerkAPIResponseError: (e: object) => 'clerkError' in e}))
vi.mock('@/lib/bugfixes', () => ({reportError: vi.fn()}))

import {externalBusy, externalBusyAroundSlots} from '@/lib/externalBusy'
import {GOOGLE_FREEBUSY_SCOPE} from '@/lib/availability'
import {reportError} from '@/lib/bugfixes'

const from = new Date('2026-10-29T00:00:00Z')
const to = new Date('2026-10-30T00:00:00Z')
const fetchMock = vi.fn()
const google = (busy: unknown[]) => ({ok: true, json: async () => ({calendars: {primary: {busy}}})})
const token = (scopes = [GOOGLE_FREEBUSY_SCOPE]) => ({data: [{token: 'tok', scopes}]})
let n = 0
const someone = () => `user_${++n}` // the cache is per module, so each test uses its own user

describe('externalBusy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("turns Google's busy periods into busy blocks", async () => {
    getUserOauthAccessToken.mockResolvedValueOnce(token())
    fetchMock.mockResolvedValueOnce(google([{start: '2026-10-29T15:00:00Z', end: '2026-10-29T16:30:00Z'}]))
    const busy = await externalBusy(someone(), from, to)
    expect(busy).toEqual([{start: new Date('2026-10-29T15:00:00Z'), durationMinutes: 90}])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://www.googleapis.com/calendar/v3/freeBusy')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{id: 'primary'}]})
  })

  it("doesn't call Google when the calendar scope wasn't granted (signed in with Google, not connected)", async () => {
    getUserOauthAccessToken.mockResolvedValueOnce(token(['openid', 'email']))
    expect(await externalBusy(someone(), from, to)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats no linked Google account as no calendar, without reporting it', async () => {
    getUserOauthAccessToken.mockRejectedValueOnce(Object.assign(new Error('not found'), {clerkError: true, status: 404}))
    expect(await externalBusy(someone(), from, to)).toEqual([])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('fails open and reports when Google errors', async () => {
    getUserOauthAccessToken.mockResolvedValueOnce(token())
    fetchMock.mockResolvedValueOnce({ok: false, status: 500})
    expect(await externalBusy(someone(), from, to)).toEqual([])
    expect(reportError).toHaveBeenCalled()
  })

  it('caches for five minutes', async () => {
    const id = someone()
    getUserOauthAccessToken.mockResolvedValue(token())
    fetchMock.mockResolvedValue(google([]))
    const now = Date.now()
    await externalBusy(id, from, to, now)
    await externalBusy(id, from, to, now + 4 * 60e3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await externalBusy(id, from, to, now + 6 * 60e3)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("looks a day either side of an availability link's slots", async () => {
    getUserOauthAccessToken.mockResolvedValueOnce(token())
    fetchMock.mockResolvedValueOnce(google([]))
    await externalBusyAroundSlots(someone(), [new Date('2026-10-30T10:00:00Z'), new Date('2026-10-29T10:00:00Z')])
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.timeMin).toBe('2026-10-28T10:00:00.000Z')
    expect(body.timeMax).toBe('2026-10-31T10:00:00.000Z')
    expect(await externalBusyAroundSlots(someone(), [])).toEqual([])
  })
})
