import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/render.tsx'
import SettingsScreen from './SettingsScreen.tsx'
import { DEFAULT_SETTINGS, type TimerSettings } from './settings.ts'

const renderForm = (initial: Partial<TimerSettings> = {}, initialName?: string) => {
  const onStart = vi.fn()
  const onSave = vi.fn()
  const onBack = vi.fn()
  const view = renderWithProviders(
    <SettingsScreen
      initial={{ ...DEFAULT_SETTINGS, ...initial }}
      initialName={initialName}
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
