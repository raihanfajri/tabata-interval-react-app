import { vi } from 'vitest'

// Minimal stand-in for Web Audio (jsdom has none). Records every oscillator
// so tests can check what was started and stopped.

const fakeParam = (value = 0) => ({
  value,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
})

export interface FakeOscillator {
  type: OscillatorType
  frequency: ReturnType<typeof fakeParam>
  connect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = []

  state: AudioContextState = 'suspended'
  currentTime = 0
  destination = {}
  oscillators: FakeOscillator[] = []
  resume = vi.fn(async () => {
    this.state = 'running'
  })

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createOscillator(): FakeOscillator {
    const osc: FakeOscillator = {
      type: 'sine',
      frequency: fakeParam(440),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    this.oscillators.push(osc)
    return osc
  }

  createGain() {
    return { gain: fakeParam(1), connect: vi.fn() }
  }
}

// Typed cast for passing the fake where an AudioContext is expected.
export const asAudioContext = (fake: FakeAudioContext) => fake as unknown as AudioContext
