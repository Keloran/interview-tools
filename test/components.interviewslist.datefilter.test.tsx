import {describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import InterviewsList from '../components/InterviewsList'
import {useQuery} from '@tanstack/react-query'

// Regression: in UK summer time local midnight on the 25th is 23:00 UTC on the 24th,
// and the list used to ask the API for the 24th, so the 25th's interviews never showed.
// Runs in Europe/London (set in vitest.config.ts).

vi.mock('@clerk/nextjs', () => ({useUser: () => ({user: {id: 'u1'}})}))
vi.mock('next/navigation', () => ({useRouter: () => ({refresh: vi.fn()})}))
vi.mock('@flags-gg/react-library', () => ({useFlags: () => ({is: () => ({enabled: () => true, disabled: () => false})})}))
vi.mock('@tanstack/react-query', () => ({useQuery: vi.fn(() => ({data: []})), useQueryClient: () => ({invalidateQueries: vi.fn()})}))
vi.mock('@/lib/guestStorage', () => ({listGuestInterviews: () => [], removeGuestInterview: vi.fn()}))
vi.mock('@/components/FreeTimes', () => ({default: () => null}))
vi.mock('@/lib/store', () => ({
  useAppStore: (selector: (s: unknown) => unknown) => selector({
    filteredDate: '2026-10-24',
    setFilteredDate: vi.fn(),
    filteredCompany: null,
    setFilteredCompany: vi.fn(),
    filteredOutcome: null,
    setFilteredOutcome: vi.fn(),
  }),
}))

const interviewsQuery = () => (useQuery as any).mock.calls.map((c: any[]) => c[0]).find((o: any) => o.queryKey[0] === 'interviews')

describe('InterviewsList date filter', () => {
  it('asks for the local day, not the UTC day before it', async () => {
    // 2026-10-24 is still BST (UTC+1), so local midnight is 23:00 UTC on the 23rd
    const fetchMock = vi.fn(async () => ({ok: true, json: async () => []}))
    global.fetch = fetchMock as any
    render(<InterviewsList/>)

    await interviewsQuery().queryFn()
    const url = new URL((fetchMock.mock.calls[0] as any)[0])
    expect(url.searchParams.get('dateFrom')).toBe('2026-10-23')
    expect(url.searchParams.get('dateTo')).toBe('2026-10-25')
    expect(url.searchParams.get('date')).toBeNull()
  })

  it('really is running in UK time', () => {
    expect(new Date('2026-10-24T00:00:00').toISOString()).toBe('2026-10-23T23:00:00.000Z')
  })

  it("shows that day's interviews and not the neighbouring days'", () => {
    const row = (id: number, date: string) => ({
      id, jobTitle: `job ${id}`, date, company: {id: 1, name: 'Admiral'},
      stage: {stage: 'First Stage'}, stageMethod: {method: 'Phone'}, outcome: 'SCHEDULED', link: null,
    })
    ;(useQuery as any).mockImplementation(({queryKey}: any) => ({
      data: queryKey[0] === 'interviews'
        ? [row(1, '2026-10-23T23:30:00Z'), row(2, '2026-10-24T09:00:00Z'), row(3, '2026-10-24T23:30:00Z')]
        : [],
    }))
    render(<InterviewsList/>)

    // 23:30 UTC on the 23rd is 00:30 BST on the 24th, so it counts; 23:30 UTC on the 24th is the 25th
    expect(screen.getByText(/job 1/)).toBeTruthy()
    expect(screen.getByText(/job 2/)).toBeTruthy()
    expect(screen.queryByText(/job 3/)).toBeNull()
  })
})
