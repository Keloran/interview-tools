import {afterEach, describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import {withQueryClient} from './utils'
import DebriefForm from '@/components/DebriefForm'

afterEach(() => vi.unstubAllGlobals())

describe('DebriefForm', () => {
  it('pre-fills who you met from the interviewer and saves what was filled in', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(JSON.stringify(init ? {} : {interviewer: 'Sam Jones', rating: null}), {status: 200}))
    vi.stubGlobal('fetch', fetchMock)
    const onSuccess = vi.fn()

    render(withQueryClient(<DebriefForm interviewId="7" onSuccess={onSuccess} />))

    expect(await screen.findByLabelText('Who you met')).toHaveValue('Sam Jones')
    await user.click(screen.getByRole('button', {name: 'Well'}))
    expect(screen.getByRole('button', {name: 'Well'})).toHaveAttribute('aria-pressed', 'true')
    await user.type(screen.getByLabelText('Questions they asked'), 'Why us?')
    await user.type(screen.getByLabelText('Hear back by'), '2026-11-06')
    await user.click(screen.getByRole('button', {name: 'Save debrief'}))

    const [url, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT')!
    expect(url).toBe('/api/interview/7')
    const {debrief} = JSON.parse(init!.body as string)
    expect(debrief).toMatchObject({rating: 4, peopleMet: 'Sam Jones', questionsAsked: 'Why us?', debriefNotes: ''})
    expect(new Date(debrief.replyBy).getDate()).toBe(6) // local day, not shifted by UTC
    expect(onSuccess).toHaveBeenCalled()
  })
})
