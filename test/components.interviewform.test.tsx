import {describe, expect, it, vi} from 'vitest'
import {fireEvent, render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InterviewForm from '@/components/InterviewForm'
import {Providers} from './utils'

// Mock fetch for companies and stages used by InterviewForm
const mockStages = [
  {id: 1, stage: 'Applied'},
  {id: 2, stage: 'Phone Screen'},
]
const mockCompanies = [
  {id: 1, name: 'Acme', applications: []},
]

function mockFetchOnce() {
  global.fetch = vi.fn()
  ;(global.fetch as any)
    .mockResolvedValueOnce({ok: true, json: async () => mockCompanies}) // /api/companies
    .mockResolvedValueOnce({ok: true, json: async () => mockStages}) // /api/stages
}

describe('Components/InterviewForm', () => {
  it('submits minimal data when stage is Applied (no scheduling required)', async () => {
    mockFetchOnce()
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(
      <Providers>
        <InterviewForm
          initialValues={{stage: 'Applied', companyName: 'Acme', jobTitle: 'SE', advertisedSalary: '£70–80k/year'}}
          onSubmit={onSubmit}
        />
      </Providers>
    )

    // Click submit
    const btn = await screen.findByRole('button', {name: /add interview stage/i})
    await user.click(btn)

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'Applied',
        advertisedSalary: '£70–80k/year',
        companyName: 'Acme',
        jobTitle: 'SE',
      })
    )
  })

  it('requires date when progressing and stage needs scheduling', async () => {
    mockFetchOnce()
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(
      <Providers>
        <InterviewForm
          initialValues={{
            stage: 'Phone Screen',
            companyName: 'Acme',
            jobTitle: 'SE',
            time: '09:00:00',
            interviewer: 'Jane',
            locationType: 'phone'
          }}
          onSubmit={onSubmit}
          isProgressing
          submitLabel="Schedule Next Stage"
        />
      </Providers>
    )

    // Without date, submit should be ignored
    const btn = await screen.findByRole('button', {name: /schedule next stage/i})
    await user.click(btn)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('progressing defaults to the stage after the current one', async () => {
    const responses: Record<string, unknown> = {
      '/api/interview/7': {id: 7, jobTitle: 'SE', company: {id: 1, name: 'Acme'}, stage: {id: 2, stage: 'Phone Screen'}},
      '/api/companies': mockCompanies,
      '/api/stages': [{id: 1, stage: 'Applied'}, {id: 2, stage: 'Phone Screen'}, {id: 3, stage: 'First Stage'}, {id: 4, stage: 'Offer'}],
    }
    global.fetch = vi.fn(async (url: string) => ({ok: true, json: async () => responses[new URL(url, 'http://x').pathname]})) as any

    render(
      <Providers>
        <InterviewForm interviewId="7" onSuccess={vi.fn()} submitLabel="Schedule Next Stage"/>
      </Providers>
    )

    // the label names the combobox; the picked stage is its text
    await screen.findByText('First Stage', {selector: '#interview-stage span'})
  })
})

describe('Offer stages', () => {
  it.each(['', '2027-01-06'])('records an optional respond-by day without scheduling a call: %s', async (day) => {
    mockFetchOnce()
    const onSubmit = vi.fn(), user = userEvent.setup()
    render(<Providers><InterviewForm initialValues={{stage: 'Offer', companyName: 'Acme', jobTitle: 'SE'}} onSubmit={onSubmit} /></Providers>)
    const deadline = screen.getByLabelText('Respond by (optional)')
    if (day) fireEvent.change(deadline, {target: {value: day}})
    await user.click(await screen.findByRole('button', {name: /add interview stage/i}))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({stage: 'Offer', offerDeadline: day, interviewer: undefined, locationType: undefined}))
  })
})
