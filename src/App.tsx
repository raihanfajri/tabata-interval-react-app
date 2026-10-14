import { useCallback, useMemo, useState } from 'react'
import IntervalTimerScreen from './timer/IntervalTimerScreen.tsx'
import SettingsScreen from './timer/SettingsScreen.tsx'
import { loadTimer } from './timer/persistence.ts'
import { buildWorkout, loadSettings, saveSettings, type TimerSettings } from './timer/settings.ts'

function App() {
  const [settings, setSettings] = useState(loadSettings)
  // A workout still in progress (saved before the app was closed) continues on
  // the timer; otherwise the app opens on the form.
  const [screen, setScreen] = useState<'form' | 'timer'>(() =>
    loadTimer(buildWorkout(settings)) ? 'timer' : 'form',
  )
  // Only a fresh Start from the form starts the timer by itself.
  const [autoStart, setAutoStart] = useState(false)
  const workout = useMemo(() => buildWorkout(settings), [settings])

  const start = (next: TimerSettings) => {
    saveSettings(next)
    setSettings(next)
    setAutoStart(true)
    setScreen('timer')
  }

  const exit = useCallback(() => {
    setAutoStart(false)
    setScreen('form')
  }, [])

  return screen === 'form' ? (
    <SettingsScreen initial={settings} onStart={start} />
  ) : (
    <IntervalTimerScreen workout={workout} autoStart={autoStart} onExit={exit} />
  )
}

export default App
