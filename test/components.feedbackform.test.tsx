import {afterEach, describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import {withQueryClient} from './utils'
import FeedbackForm from '@/components/FeedbackForm'

afterEach(() => vi.unstubAllGlobals())

const setup = (saved: object) => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify(init ? {} : saved)))
  vi.stubGlobal('fetch', fetchMock)
  const sent = () => JSON.parse(fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT')![1]!.body as string)
  return {sent}
}

describe('FeedbackForm', () => {
  it('rejecting asks for feedback and marks it rejected in one go', async () => {
    const user = userEvent.setup()
    const {sent} = setup({feedbackType: null, feedbackText: null})
    const onSuccess = vi.fn()
    render(withQueryClient(<FeedbackForm interviewId="7" reject onSuccess={onSuccess} />))

    await user.click(await screen.findByRole('button', {name: 'Specific'}))
    await user.type(screen.getByLabelText('What they said'), 'More system design')
    await user.click(screen.getByRole('button', {name: 'Mark as rejected'}))

    expect(sent()).toEqual({outcome: 'REJECTED', feedback: {type: 'SPECIFIC', text: 'More system design'}})
    expect(onSuccess).toHaveBeenCalled()
  })

  it('can be edited later without touching the outcome, and rejecting can skip feedback', async () => {
    const user = userEvent.setup()
    const {sent} = setup({feedbackType: 'GENERIC', feedbackText: 'Went with someone else'})
    render(withQueryClient(<FeedbackForm interviewId="7" />))

    expect(await screen.findByRole('button', {name: 'Generic'})).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('What they said')).toHaveValue('Went with someone else')
    await user.click(screen.getByRole('button', {name: 'No feedback'}))
    expect(screen.queryByLabelText('What they said')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', {name: 'Save feedback'}))

    expect(sent()).toEqual({feedback: {type: 'NONE', text: 'Went with someone else'}})
  })
})
