// Synthesized cue sounds (Web Audio), so the app needs no audio files and
// works offline. Each function schedules its sound from `audio.currentTime`.

// Fades `gain` in over `attack` seconds, then out by `end`, to avoid clicks.
function envelope(gain: AudioParam, start: number, peak: number, attack: number, end: number) {
  gain.setValueAtTime(0.0001, start)
  gain.exponentialRampToValueAtTime(peak, start + attack)
  gain.exponentialRampToValueAtTime(0.0001, end)
}

// Short neutral tone for the 3-2-1 countdown.
export function playBeep(audio: AudioContext) {
  const t = audio.currentTime
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'sine'
  osc.frequency.value = 880
  envelope(gain.gain, t, 0.5, 0.01, t + 0.15)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(t)
  osc.stop(t + 0.16)
}

// Referee pea whistle, for the start of a Work interval: a high tone whose
// pitch is warbled ~30 times a second, like the pea rattling inside.
export function playWhistle(audio: AudioContext) {
  const t = audio.currentTime
  const duration = 0.6

  const tone = audio.createOscillator()
  const gain = audio.createGain()
  tone.type = 'triangle'
  tone.frequency.value = 2800
  envelope(gain.gain, t, 0.35, 0.02, t + duration)

  const trill = audio.createOscillator()
  const trillDepth = audio.createGain()
  trill.type = 'sine'
  trill.frequency.value = 30
  trillDepth.gain.value = 180 // ± Hz around 2800
  trill.connect(trillDepth)
  trillDepth.connect(tone.frequency)

  tone.connect(gain)
  gain.connect(audio.destination)
  for (const osc of [tone, trill]) {
    osc.start(t)
    osc.stop(t + duration + 0.05)
  }
}

// Boxing ring bell, for the start of a Rest interval and the end of the
// workout: three quick strikes of inharmonic metallic partials that ring out,
// higher partials fading faster.
const BELL_PARTIALS = [
  { ratio: 1, level: 0.3, decay: 1.6 },
  { ratio: 2.0, level: 0.16, decay: 1.1 },
  { ratio: 2.76, level: 0.12, decay: 0.9 },
  { ratio: 4.07, level: 0.08, decay: 0.6 },
  { ratio: 5.4, level: 0.05, decay: 0.4 },
]

export function playBell(audio: AudioContext) {
  const t = audio.currentTime
  const fundamental = 640
  for (const strike of [0, 0.32, 0.64]) {
    for (const { ratio, level, decay } of BELL_PARTIALS) {
      const start = t + strike
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = 'sine'
      osc.frequency.value = fundamental * ratio
      envelope(gain.gain, start, level, 0.003, start + decay)
      osc.connect(gain)
      gain.connect(audio.destination)
      osc.start(start)
      osc.stop(start + decay + 0.05)
    }
  }
}
