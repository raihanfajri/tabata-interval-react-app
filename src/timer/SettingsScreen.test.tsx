import { act, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getMockSavedWorkout } from '../test/factories.ts'
import { renderWithProviders } from '../test/render.tsx'
import SettingsScreen from './SettingsScreen.tsx'
import type { SavedWorkout } from './savedWorkouts.ts'
import { DEFAULT_SETTINGS, type TimerSettings } from './settings.ts'

const renderForm = (
  initial: Partial<TimerSettings> = {},
  initialName?: string,
  { workouts = [], savedName }: { workouts?: SavedWorkout[]; savedName?: string } = {},
) => {
  const onStart = vi.fn()
  const onSave = vi.fn()
  const onBack = vi.fn()
  const view = renderWithProviders(
    <SettingsScreen
      initial={{ ...DEFAULT_SETTINGS, ...initial }}
      initialName={initialName}
      workouts={workouts}
      savedName={savedName}
      onStart={onStart}
      onSave={onSave}
      onBack={onBack}
    />,
  )
  return { ...view, onStart, onSave, onBack }
}

const field = (name: string) => screen.getByRole('textbox', { name })

describe('SettingsScreen', () => {
  describe('steppers', () => {
    it('change a time by 5s and a count by 1', async () => {
      const { user } = renderForm()

      await user.click(screen.getByRole('button', { name: 'Increase Work' }))
      await user.click(screen.getByRole('button', { name: 'Decrease Rest' }))
      await user.click(screen.getByRole('button', { name: 'Increase Sets' }))

      expect(field('Work (seconds)')).toHaveValue('25')
      expect(field('Rest (seconds)')).toHaveValue('5')
      expect(field('Sets')).toHaveValue('3')
    })

    it.each([
      ['Decrease Work', 'Work (seconds)', { workSec: 1 }, '1'],
      ['Decrease Work', 'Work (seconds)', { workSec: 3 }, '1'],
      ['Increase Prepare', 'Prepare (seconds)', { prepareSec: 58 }, '60'],
      ['Decrease Rest', 'Rest (seconds)', { restSec: 0 }, '0'],
      ['Increase Cycles per set', 'Cycles per set', { cycles: 30 }, '30'],
    ])('stop at the limits: %s (%s from %o) gives %s', async (button, name, initial, expected) => {
      const { user } = renderForm(initial)

      await user.click(screen.getByRole('button', { name: button }))

      expect(field(name)).toHaveValue(expected)
    })
  })

  describe('errors', () => {
    it('typing an invalid value shows its error under the field and disables Start until it is fixed', async () => {
      const { user } = renderForm()
      const work = field('Work (seconds)')

      await user.clear(work)
      await user.type(work, '0')

      expect(work).toHaveAccessibleDescription('Work must be between 1 and 600 seconds.')
      expect(work).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
      expect(screen.getByText('Total –')).toBeInTheDocument()

      await user.type(work, '5')

      expect(work).not.toHaveAccessibleDescription()
      expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled()
    })

    it('Start passes the parsed settings to onStart', async () => {
      const { user, onStart } = renderForm()

      await user.click(screen.getByRole('button', { name: 'Start' }))

      expect(onStart).toHaveBeenCalledWith(DEFAULT_SETTINGS, '')
    })
  })

  describe('naming and saving', () => {
    it('Save passes the trimmed name and the parsed settings to onSave and confirms "Saved “Tabata”"', async () => {
      const { user, onSave } = renderForm()

      await user.type(field('Name'), '  Tabata ')
      await user.click(screen.getByRole('button', { name: 'Increase Work' }))
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(onSave).toHaveBeenCalledWith('Tabata', { ...DEFAULT_SETTINGS, workSec: 25 })
      expect(screen.getByRole('status')).toHaveTextContent('Saved “Tabata”')
      expect(field('Name')).toHaveValue('Tabata')
    })

    it('the confirmation clears as soon as a value changes', async () => {
      const { user } = renderForm({}, 'Tabata')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      await user.click(screen.getByRole('button', { name: 'Increase Sets' }))

      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })

    it('Save with a blank name shows "Enter a name to save this workout." on the Name field and saves nothing', async () => {
      const { user, onSave } = renderForm()

      await user.type(field('Name'), '   ')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(onSave).not.toHaveBeenCalled()
      expect(field('Name')).toHaveAccessibleDescription('Enter a name to save this workout.')

      await user.type(field('Name'), 'x')
      expect(field('Name')).not.toHaveAccessibleDescription()
    })

    it('Save is disabled while a setting is invalid', async () => {
      const { user } = renderForm({}, 'Tabata')

      await user.clear(field('Work (seconds)'))

      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    })

    it('shows the initial name, and Start passes it along with the settings', async () => {
      const { user, onStart } = renderForm({}, 'Tabata')

      expect(field('Name')).toHaveValue('Tabata')
      await user.click(screen.getByRole('button', { name: 'Start' }))

      expect(onStart).toHaveBeenCalledWith(DEFAULT_SETTINGS, 'Tabata')
    })

    it('limits the name to 40 characters', () => {
      renderForm()

      expect(field('Name')).toHaveAttribute('maxLength', '40')
    })

    describe('when the name is taken by another saved workout', () => {
      const tabata = getMockSavedWorkout({ name: 'Tabata', settings: { ...DEFAULT_SETTINGS, workSec: 45 } })
      const replaceSheet = () => screen.getByRole('alertdialog', { name: 'Replace “Tabata”?' })

      const saveAsTaken = async () => {
        const view = renderForm({}, undefined, { workouts: [tabata] })
        await view.user.type(field('Name'), 'tabata ')
        await view.user.click(screen.getByRole('button', { name: 'Save' }))
        return view
      }

      it('Save asks "Replace “Tabata”?" first, with Cancel focused, and saves nothing yet', async () => {
        const { onSave } = await saveAsTaken()

        expect(within(replaceSheet()).getByRole('button', { name: 'Cancel' })).toHaveFocus()
        expect(onSave).not.toHaveBeenCalled()
      })

      it('Replace saves under the typed name and confirms it', async () => {
        const { user, onSave } = await saveAsTaken()

        await user.click(within(replaceSheet()).getByRole('button', { name: 'Replace' }))

        expect(onSave).toHaveBeenCalledWith('tabata', DEFAULT_SETTINGS)
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Saved “tabata”')
      })

      it('Cancel closes the sheet, saves nothing and keeps the form as it was', async () => {
        const { user, onSave } = await saveAsTaken()

        await user.click(within(replaceSheet()).getByRole('button', { name: 'Cancel' }))

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(onSave).not.toHaveBeenCalled()
        expect(field('Name')).toHaveValue('tabata ')
      })

      it('Android back dismisses the sheet like Cancel', async () => {
        const { onSave } = await saveAsTaken()

        act(() => {
          window.dispatchEvent(new PopStateEvent('popstate'))
        })

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(onSave).not.toHaveBeenCalled()
      })

      it('after replacing it once, saving again under that name does not ask', async () => {
        const { user, onSave } = await saveAsTaken()
        await user.click(within(replaceSheet()).getByRole('button', { name: 'Replace' }))

        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(onSave).toHaveBeenCalledTimes(2)
      })
    })

    it('saving the workout being edited under its own name (any case) updates it without asking', async () => {
      const tabata = getMockSavedWorkout({ name: 'Tabata' })
      const { user, onSave } = renderForm({}, 'Tabata', { workouts: [tabata], savedName: 'Tabata' })
      await user.clear(field('Name'))
      await user.type(field('Name'), 'TABATA')

      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(onSave).toHaveBeenCalledWith('TABATA', DEFAULT_SETTINGS)
    })

    it('a name no saved workout has saves without asking', async () => {
      const { user, onSave } = renderForm({}, undefined, { workouts: [getMockSavedWorkout({ name: 'Tabata' })] })
      await user.type(field('Name'), 'Hard')

      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(onSave).toHaveBeenCalled()
    })

    it('the back arrow calls onBack', async () => {
      const { user, onBack } = renderForm()

      await user.click(screen.getByRole('button', { name: 'Back' }))

      expect(onBack).toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('every field and stepper button has an accessible name, and an error is announced and tied to its field', async () => {
      const { user } = renderForm()
      for (const name of ['Prepare (seconds)', 'Work (seconds)', 'Rest (seconds)', 'Rest between sets (seconds)', 'Sets', 'Cycles per set']) {
        expect(field(name)).toBeInTheDocument()
      }
      for (const label of ['Prepare', 'Work', 'Rest', 'Rest between sets', 'Sets', 'Cycles per set']) {
        expect(screen.getByRole('button', { name: `Increase ${label}` })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: `Decrease ${label}` })).toBeInTheDocument()
      }

      await user.clear(field('Sets'))
      await user.type(field('Sets'), '11')

      expect(screen.getByRole('alert')).toHaveTextContent('Sets must be between 1 and 10.')
      expect(field('Sets')).toHaveAccessibleDescription('Sets must be between 1 and 10.')
    })
  })
})
