import {describe, expect, it} from 'vitest'
import {render, screen} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import SendMessage from '@/components/SendMessage'

describe('SendMessage', () => {
  it('starts with the first template filled in, editable, ready to copy', async () => {
    const user = userEvent.setup()
    render(<SendMessage templates={['thank-you', 'follow-up']} context={{jobTitle: 'Senior Engineer', company: 'Payter', interviewer: 'Sam Jones'}} />)

    const box = screen.getByLabelText('Message to send') as HTMLTextAreaElement
    expect(box.value).toMatch(/^Hi Sam,\n\nThank you for taking the time/)

    await user.type(box, ' PS')
    expect(box.value).toMatch(/Thanks PS$/)
    expect(screen.getByRole('button', {name: 'Copy message'})).toBeInTheDocument()
  })
})
