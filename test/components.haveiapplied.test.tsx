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

  it('yes: recognises an abbreviated developer title as the same engineer role', async () => {
    expect(await check('BigBank', 'Sr. Dev. (m/f/d) - Remote')).toHaveTextContent("Yes, you've applied for this")
  })

  it('no: offers to add it', async () => {
    const status = await check('Initech', 'Engineer')
    expect(status).toHaveTextContent("No matching application found")
    expect(screen.getByRole('button', {name: 'Add it'})).toBeInTheDocument()
  })

  it('same company, different role', async () => {
    expect(await check('Acme', 'Engineer')).toHaveTextContent("Not for this role, but you've applied to Acme before")
  })
})

describe('job description check', () => {
  async function checkListing(description: string, company = '', title = '') {
    const user = userEvent.setup()
    render(withQueryClient(<HaveIApplied withDescription />))
    if (company) await user.type(screen.getByLabelText('Job link or company'), company)
    if (title) await user.type(screen.getByLabelText('Job title'), title)
    if (description) await user.type(screen.getByLabelText('Job description'), description)
    await vi.waitFor(() => expect(screen.getByRole('button', {name: /Check/})).toBeEnabled())
    await user.click(screen.getByRole('button', {name: /Check/}))
    return screen.findByRole('status')
  }

  it('checks pasted text and explains each finding with evidence', async () => {
    const status = await checkListing('We need a rockstar. Complete an unpaid take-home test.')
    expect(status).toHaveTextContent('No salary amount found')
    expect(status).toHaveTextContent('An unpaid assessment is mentioned')
    expect(status).toHaveTextContent('Vague role language')
    expect(status.querySelector('blockquote')).toHaveTextContent('unpaid take-home test')
    expect(status).not.toHaveTextContent('No warning signs found')
  })

  it('shows a positive when pasted text has no flags', async () => {
    const status = await checkListing('Software Engineer. Salary: £50,000–£70,000 per year. Build websites.')
    expect(status).toHaveTextContent('No warning signs found in the text you provided.')
    expect(screen.queryByRole('button', {name: 'Add it'})).not.toBeInTheDocument()
  })

  it('only checks history for a link and asks for text to check the listing', async () => {
    const status = await checkListing('', 'https://example.com/jobs/unknown')
    expect(status).toHaveTextContent('No matching application found')
    expect(status).toHaveTextContent('Paste the job description to check the listing itself.')
    expect(status).not.toHaveTextContent('No salary amount found')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/companies', expect.anything())
  })

  it('includes personal history and keeps the previous application details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      {...history[0], applications: [app(1, 'Senior Engineer', {clientCompany: 'BigBank', response: 'ghosted', feedback: 'NONE'})]},
    ]))))
    const status = await checkListing('Salary: £60000', 'BigBank', 'Senior Engineer')
    expect(status).toHaveTextContent("Yes, you've applied for this")
    expect(status).toHaveTextContent('Previous applications went unanswered')
    expect(status).toHaveTextContent('No feedback in your recorded rejections')
    expect(status).toHaveTextContent('BigBank via Hays')
  })

  it('reports history loading failures instead of showing a reassuring result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', {status: 500})))
    render(withQueryClient(<HaveIApplied withDescription />))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your application history')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', {name: /Check/})).toBeDisabled()
  })

  it('requires some input before checking', () => {
    render(withQueryClient(<HaveIApplied withDescription />))
    expect(screen.getByRole('button', {name: /Check/})).toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
