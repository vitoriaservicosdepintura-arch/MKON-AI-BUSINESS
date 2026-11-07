/**
 * Efeitos sonoros sintetizados com a Web Audio API — sem ficheiros externos.
 * Podem ser ligados/desligados pelo utilizador (ver uiPrefs).
 */

let ctx: AudioContext | null = null
let enabled = true

export function setSfxEnabled(value: boolean) {
    enabled = value
    if (!value) {
        try { ctx?.suspend() } catch { /* ignore */ }
    }
}

function audioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!ctx) {
        try { ctx = new Ctor() } catch { return null }
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
}

function tone(freq: number, delay: number, duration: number, type: OscillatorType = 'sine', peak = 0.05) {
    const ac = audioContext()
    if (!ac) return
    const start = ac.currentTime + delay
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(gain).connect(ac.destination)
    osc.start(start)
    osc.stop(start + duration + 0.02)
}

/** Clique curto de botão/ligação. */
export function playClick() {
    if (!enabled) return
    tone(1180, 0, 0.055, 'triangle', 0.035)
    tone(1760, 0.015, 0.05, 'sine', 0.02)
}

/** Transição entre páginas (varredura descendente suave). */
export function playNavigate() {
    if (!enabled) return
    const ac = audioContext()
    if (!ac) return
    const start = ac.currentTime
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, start)
    osc.frequency.exponentialRampToValueAtTime(420, start + 0.22)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.03, start + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
    osc.connect(gain).connect(ac.destination)
    osc.start(start)
    osc.stop(start + 0.34)
}

/** Ativação do MKON Bot. */
export function playBotOpen() {
    if (!enabled) return
    tone(660, 0, 0.12, 'sine', 0.04)
    tone(990, 0.09, 0.14, 'sine', 0.04)
    tone(1320, 0.19, 0.2, 'sine', 0.03)
}

/** Fecho do MKON Bot. */
export function playBotClose() {
    if (!enabled) return
    tone(990, 0, 0.1, 'sine', 0.03)
    tone(620, 0.08, 0.16, 'sine', 0.03)
}
