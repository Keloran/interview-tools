import {afterEach, describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import {withQueryClient} from './utils'
import FollowUps from '@/components/FollowUps'

afterEach(() => vi.unstubAllGlobals())

describe('FollowUps', () => {
  it('shows why each is due, offers the chase message and logs it when sent', async () => {
    const user = userEvent.setup()
    const due = [{
      id: 3, jobTitle: 'Senior Engineer', company: 'Hays', clientCompany: 'Acme', applicationDate: '2026-10-01T00:00:00Z',
      stage: 'Technical', interviewer: 'Sam Jones', date: '2026-10-09T10:00:00Z', nextStep: null,
      replyBy: '2026-10-12T00:00:00Z', followUps: 0, lastFollowUp: null, dueAt: '2026-10-13T00:00:00Z',
    }]
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(JSON.stringify(init ? {id: 1} : due), {status: init ? 201 : 200}))
    vi.stubGlobal('fetch', fetchMock)

    render(withQueryClient(<FollowUps />))

    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.getByText(/Said they'd reply by/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', {name: 'Follow up'}))
    expect((screen.getByLabelText('Message to send') as HTMLTextAreaElement).value)
      .toContain('follow up after my Technical interview on')
    await user.click(screen.getByRole('button', {name: "I've sent it"}))

    const post = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(JSON.parse(post[1]!.body as string)).toEqual({applicationId: 3})
  })
})
