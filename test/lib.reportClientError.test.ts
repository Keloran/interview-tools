import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('bugfixes', () => ({error: vi.fn(), setDefaultConfig: vi.fn()}))

describe('reportClientError', () => {
  beforeEach(() => vi.resetModules())

  it('reports with the page path and drops repeats', async () => {
    const {error} = await import('bugfixes')
    const {reportClientError} = await import('@/lib/reportClientError')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('boom')

    reportClientError('Failed to save interview', err)
    reportClientError('Failed to save interview', err)

    expect(error).toHaveBeenCalledTimes(1)
    expect((error as any).mock.calls[0]).toEqual(['[browser] Failed to save interview', `(${window.location.pathname})`, err])
  })

  it('stops after 20 different errors on one page', async () => {
    const {error} = await import('bugfixes')
    ;(error as any).mockClear()
    const {reportClientError} = await import('@/lib/reportClientError')
    vi.spyOn(console, 'error').mockImplementation(() => {})

    for (let i = 0; i < 25; i++) reportClientError(`error ${i}`)
    expect(error).toHaveBeenCalledTimes(20)
  })
})
