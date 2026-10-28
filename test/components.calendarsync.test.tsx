import {beforeEach, describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import {GOOGLE_FREEBUSY_SCOPE} from '@/lib/availability'

const clerk = vi.hoisted(() => ({user: null as unknown}))
vi.mock('@clerk/nextjs', () => ({useUser: () => ({user: clerk.user})}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({invalidateQueries: vi.fn()}),
  useQuery: () => ({data: {calendarUuid: 'u', calendarUrl: 'https://x/cal'}, isLoading: false}),
  useMutation: () => ({mutate: vi.fn(), isPending: false}),
}))

import CalendarSync from '@/components/CalendarSync'

const redirect = {externalVerificationRedirectURL: new URL('https://accounts.google.com/o/oauth2')}

describe('CalendarSync: Google Calendar busy times', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for the calendar scope on the Google account you signed in with', async () => {
    const reauthorize = vi.fn(async () => ({verification: redirect}))
    clerk.user = {externalAccounts: [{provider: 'google', approvedScopes: 'openid email profile', reauthorize}], createExternalAccount: vi.fn()}
    const assign = vi.spyOn(window, 'location', 'get').mockReturnValue({href: 'https://interviews.tools/'} as Location)
    render(<CalendarSync/>)
    await userEvent.setup().click(screen.getByRole('button', {name: 'Connect Google Calendar'}))
    expect(reauthorize).toHaveBeenCalledWith({additionalScopes: [GOOGLE_FREEBUSY_SCOPE], redirectUrl: 'https://interviews.tools/'})
    assign.mockRestore()
  })

  it("links Google when you didn't sign in with it", async () => {
    const createExternalAccount = vi.fn(async () => ({verification: redirect}))
    clerk.user = {externalAccounts: [], createExternalAccount}
    render(<CalendarSync/>)
    await userEvent.setup().click(screen.getByRole('button', {name: 'Connect Google Calendar'}))
    expect(createExternalAccount).toHaveBeenCalledWith(expect.objectContaining({strategy: 'oauth_google', additionalScopes: [GOOGLE_FREEBUSY_SCOPE]}))
  })

  it('shows connected once the scope is granted', () => {
    clerk.user = {externalAccounts: [{provider: 'google', approvedScopes: `openid ${GOOGLE_FREEBUSY_SCOPE}`}]}
    render(<CalendarSync/>)
    expect(screen.getByText(/^Connected\./)).toBeTruthy()
    expect(screen.queryByRole('button', {name: 'Connect Google Calendar'})).toBeNull()
  })
})
