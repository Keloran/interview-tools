import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import {withQueryClient} from './utils'
import HaveIApplied from '@/components/HaveIApplied'

const app = (id: number, jobTitle: string, extra: object = {}) =>
  ({id, jobTitle, clientCompany: null, jobPostingLink: null, applicationDate: new Date(Date.now() - 21 * 864e5).toISOString(), status: 'Awaiting response (Applied)', response: 'waiting', ...extra})

const history = [
  {id: 1, name: 'Hays', applications: [app(1, 'Senior Engineer', {clientCompany: 'BigBank', jobPostingLink: 'https://www.linkedin.com/jobs/view/4012345678/?trackingId=a'})]},
  {id: 2, name: 'Acme', applications: [app(2, 'Data Analyst')]},
]

beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(history)))))
afterEach(() => vi.unstubAllGlobals())

async function check(text: string, title = '') {
  const user = userEvent.setup()
  render(withQueryClient(<HaveIApplied />))
  if (title) await user.type(screen.getByLabelText('Job title'), title)
  await user.type(screen.getByLabelText('Job link or company'), text)
  // enabled once your history has loaded
  await vi.waitFor(() => expect(screen.getByRole('button', {name: /Check/})).toBeEnabled())
  await user.keyboard('{Enter}')
  return screen.findByRole('status')
}

describe('HaveIApplied', () => {
  it('yes: a pasted link matches the same posting, even through a recruiter', async () => {
    const status = await check('https://uk.linkedin.com/jobs/view/4012345678?refId=zzz')
    expect(status).toHaveTextContent("Yes, you've applied for this")
    expect(status).toHaveTextContent('Senior EngineerSame posting')
    expect(status).toHaveTextContent('BigBank via Hays · applied 3 weeks ago')
    expect(screen.queryByRole('button', {name: 'Add it'})).not.toBeInTheDocument()
  })

  it('yes: finding it direct matches the recruiter application by client company', async () => {
    expect(await check('BigBank', 'senior engineer')).toHaveTextContent("Yes, you've applied for this")
  })

  it('no: offers to add it', async () => {
    const status = await check('Initech', 'Engineer')
    expect(status).toHaveTextContent("No, you haven't applied for this")
    expect(screen.getByRole('button', {name: 'Add it'})).toBeInTheDocument()
  })

  it('same company, different role', async () => {
    expect(await check('Acme', 'Engineer')).toHaveTextContent("Not for this role, but you've applied to Acme before")
  })
})
