import {describe, expect, it, vi} from 'vitest'

vi.mock('@/lib/bugfixes', () => ({reportError: vi.fn()}))
import {reportError} from '@/lib/bugfixes'
import {onRequestError} from '../instrumentation'

const request = {path: '/', method: 'POST', headers: {}}
const context = {routerKind: 'App Router', routePath: '/', routeType: 'render', renderSource: 'react-server-components'}

describe('onRequestError', () => {
  it('reports real errors with method, path and route', async () => {
    const err = new Error('boom')
    await onRequestError(err, request, context as any)
    expect(reportError).toHaveBeenCalledWith('POST / failed', '(render /)', err)
  })

  it('ignores bots probing for server actions', async () => {
    vi.mocked(reportError).mockClear()
    await onRequestError(new Error('Failed to find Server Action. This request might be from an older or newer deployment.'), request, context as any)
    expect(reportError).not.toHaveBeenCalled()
  })
})
