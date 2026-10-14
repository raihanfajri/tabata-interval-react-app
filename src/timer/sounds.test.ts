import { describe, expect, it } from 'vitest'
import { asAudioContext, FakeAudioContext } from '../test/fakeAudio.ts'
import { playBeep, playBell, playWhistle } from './sounds.ts'

describe('sounds', () => {
  it.each([
    ['beep', playBeep],
    ['whistle', playWhistle],
    ['bell', playBell],
  ])('%s starts its oscillators and schedules a stop for every one of them', (_name, play) => {
    const audio = new FakeAudioContext()

    play(asAudioContext(audio))

    expect(audio.oscillators.length).toBeGreaterThan(0)
    for (const osc of audio.oscillators) {
      expect(osc.start).toHaveBeenCalledOnce()
      expect(osc.stop).toHaveBeenCalledOnce()
    }
  })
})
