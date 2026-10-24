import {describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import ShareAvailability from '@/components/ShareAvailability'

vi.mock('@/components/AvailabilityLinks', () => ({default: () => null}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({invalidateQueries: vi.fn()}),
  // no other interviews that day, so every time between 9 and 6 is free
  useQuery: ({queryKey}: {queryKey: string[]}) => ({
    data: queryKey[0] === 'stages'
      ? [{id: 1, stage: 'Applied'}, {id: 2, stage: 'Phone Screen'}, {id: 3, stage: 'First Stage'}, {id: 4, stage: 'Offer'}]
      : [],
    isLoading: false,
  }),
}))

describe('ShareAvailability time picking', () => {
  it('shows a picked time as selected, and clicking it again removes it', async () => {
    const user = userEvent.setup()
    render(<ShareAvailability interviewId="1"/>)

    const time = screen.getAllByRole('button', {pressed: false}).find((b) => /\d:\d{2}/.test(b.textContent ?? ''))!
    await user.click(time)
    expect(time.getAttribute('aria-pressed')).toBe('true')
    expect(time.getAttribute('title')).toBe('Picked: click to remove')
    expect(time.querySelector('svg')).not.toBeNull() // the tick

    await user.click(time)
    expect(time.getAttribute('aria-pressed')).toBe('false')
    expect(time.querySelector('svg')).toBeNull()
  })

  it('picks the next stage for you, which you can still change', () => {
    render(<ShareAvailability interviewId="1" currentStage="Phone Screen"/>)
    expect(document.getElementById('availability-stage')?.textContent).toBe('First Stage')
  })
})
