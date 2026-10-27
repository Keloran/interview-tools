import {describe, expect, it} from 'vitest'
import {render, screen} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import {Dialog, DialogContent, DialogTitle} from '@/components/ui/dialog'
import StageCombobox from '@/components/StageCombobox'

// The combobox's list is portalled outside the dialog, so the dialog's focus trap must not pull focus back
describe('combobox inside a dialog', () => {
  it('lets you click into the search box and type', async () => {
    const user = userEvent.setup()
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Add</DialogTitle>
          <StageCombobox id="s" stages={[{id: 1, stage: 'Phone Screen'}, {id: 2, stage: 'Technical'}]} value="" onChange={() => {}} />
        </DialogContent>
      </Dialog>,
    )
    await user.click(screen.getByRole('combobox'))
    const search = await screen.findByPlaceholderText('Search stages')
    await user.click(search)
    await user.keyboard('tech')
    expect(search).toHaveFocus()
    expect(search).toHaveValue('tech')
  })
})
