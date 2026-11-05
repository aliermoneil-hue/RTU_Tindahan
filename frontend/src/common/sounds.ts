/**
 * Web Audio API synthesizer for UI sound effects.
 * 100% offline, lightweight, and zero external asset dependencies.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

/** Soft bubble pop for button clicks, toggles, chips, and menu interactions */
export function playPop() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(420, now)
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.06)

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.08)
  } catch {
    /* audio not allowed or failed */
  }
}

/** Cheerful ascending chime for order completed, cart add, and success states */
export function playSuccess() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    const notes = [523.25, 659.25, 783.99] // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const t = now + i * 0.07

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, t)

      gain.gain.setValueAtTime(0.15, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(t)
      osc.stop(t + 0.22)
    })
  } catch {
    /* ignore */
  }
}

/** Sweet high-pitched plink/sparkle for favoriting/liking */
export function playHeart() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, now)
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.08)

    gain.gain.setValueAtTime(0.16, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.16)
  } catch {
    /* ignore */
  }
}

/** Chat message send/receive pop */
export function playMessage() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()

    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now) // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.05)

    gain1.gain.setValueAtTime(0.12, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)

    osc1.start(now)
    osc1.stop(now + 0.09)
  } catch {
    /* ignore */
  }
}

/** Subtle crisp tick for tab switching */
export function playTab() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.03)

    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.04)
  } catch {
    /* ignore */
  }
}

/** Notification chime */
export function playNotice() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(783.99, now) // G5
    osc.frequency.setValueAtTime(1046.5, now + 0.08) // C6

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.25)
  } catch {
    /* ignore */
  }
}

/** Trash / remove item sound */
export function playRemove() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(380, now)
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.1)

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.12)
  } catch {
    /* ignore */
  }
}
