import {describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InterviewForm from '@/components/InterviewForm'
import {Providers} from './utils'

// Mock fetch for companies and stages used by InterviewForm
const mockStages = [
  {id: 1, stage: 'Applied'},
  {id: 2, stage: 'Phone Screen'},
]
const mockCompanies = [
  {id: 1, name: 'Acme'},
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
          initialValues={{stage: 'Applied', companyName: 'Acme', jobTitle: 'SE'}}
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
})
