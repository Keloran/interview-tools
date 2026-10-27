import {beforeEach, describe, expect, it, vi} from 'vitest'
import prisma from '@/lib/prisma'

const deleteUser = vi.fn()
vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(async () => ({id: 'user_123'})),
  clerkClient: async () => ({users: {deleteUser}}),
}))
vi.mock('@clerk/nextjs/webhooks', () => ({verifyWebhook: vi.fn(async () => ({type: 'user.deleted', data: {id: 'user_456'}}))}))

const {DELETE} = await import('@/app/api/account/route')
const del = (confirm?: string) =>
  DELETE(new Request('http://x/api/account', {method: 'DELETE', body: JSON.stringify({confirm})}) as any)

describe('DELETE /api/account', () => {
  beforeEach(() => vi.clearAllMocks())

  it('needs the confirmation typed out, and deletes nothing without it', async () => {
    expect((await del('yes')).status).toBe(400)
    expect((await del()).status).toBe(400)
    expect(prisma.user.deleteMany).not.toHaveBeenCalled()
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('deletes the data, then the login', async () => {
    const res = await del('  Delete my account ')
    expect(res.status).toBe(204)
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({where: {clerkId: 'user_123'}})
    expect(deleteUser).toHaveBeenCalledWith('user_123')
  })

  it('keeps the login if the data could not be deleted', async () => {
    ;(prisma.user.deleteMany as any).mockRejectedValueOnce(new Error('db down'))
    expect((await del('delete my account')).status).toBe(500)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('says so when the data went but the login did not, so a retry finishes it', async () => {
    deleteUser.mockRejectedValueOnce(new Error('clerk down'))
    const res = await del('delete my account')
    expect(res.status).toBe(502)
    expect((await res.json()).message).toMatch(/data is deleted/)
  })
})

describe('Clerk user.deleted webhook', () => {
  it('removes the data of a user deleted from Clerk', async () => {
    const {POST} = await import('@/app/api/webhooks/clerk/route')
    const res = await POST(new Request('http://x/api/webhooks/clerk', {method: 'POST'}) as any)
    expect(res.status).toBe(200)
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({where: {clerkId: 'user_456'}})
  })
})
