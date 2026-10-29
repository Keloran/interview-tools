import {beforeEach, expect, it, vi} from 'vitest'
import {currentUser} from '@clerk/nextjs/server'
import {GET} from '@/app/api/mobile-capabilities/route'

beforeEach(() => vi.clearAllMocks())
it('requires authentication', async () => {
  vi.mocked(currentUser).mockResolvedValueOnce(null)
  expect((await GET()).status).toBe(401)
})
it('advertises safe native create retries only from the supporting deployment', async () => {
  vi.mocked(currentUser).mockResolvedValueOnce({id: 'user_123'} as any)
  expect(await (await GET()).json()).toEqual({interviewCreateIdempotency: 1})
})
it('native create refuses requests without a stable upload identity', async () => {
  vi.mocked(currentUser).mockResolvedValueOnce({id: 'user_123'} as any)
  const {POST} = await import('@/app/api/native/interview/route')
  const request = new Request('http://localhost/api/native/interview', {method: 'POST', body: JSON.stringify({stage: 'Applied', companyName: 'Example', jobTitle: 'Engineer'})})
  expect((await POST(request as any)).status).toBe(400)
})
it('native create requires authentication', async () => {
  vi.mocked(currentUser).mockResolvedValueOnce(null)
  const {POST} = await import('@/app/api/native/interview/route')
  const request = new Request('http://localhost/api/native/interview', {method: 'POST', body: '{}'})
  expect((await POST(request as any)).status).toBe(401)
})
