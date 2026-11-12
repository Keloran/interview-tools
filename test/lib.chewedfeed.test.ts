import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {syncCustomer} from '@/lib/chewedfeed'

describe('syncCustomer', () => {
  const fetchMock = vi.fn(async () => new Response(null, {status: 200}))
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('CHEWEDFEED_API_URL', 'https://hq.test/')
    vi.stubEnv('CHEWEDFEED_ENQUIRY_KEY', 'ek')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    fetchMock.mockClear()
  })

  it('sends a free customer to the standard hook', async () => {
    await syncCustomer({clerkId: 'user_1', email: 'a@b.c', name: 'Ann'})
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://hq.test/api/product-customers/sync')
    expect((init.headers as Record<string, string>)['x-enquiry-key']).toBe('ek')
    expect(JSON.parse(init.body as string)).toEqual({external_customer_id: 'user_1', email: 'a@b.c', name: 'Ann', plan: 'free'})
  })

  it('skips placeholder emails, and does nothing unconfigured', async () => {
    await syncCustomer({clerkId: 'user_1', email: 'user_1@example.com'})
    vi.stubEnv('CHEWEDFEED_ENQUIRY_KEY', '')
    await syncCustomer({clerkId: 'user_2', email: 'a@b.c'})
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
