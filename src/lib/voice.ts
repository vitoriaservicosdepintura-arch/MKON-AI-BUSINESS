/**
 * Voz do MKON Bot — síntese de fala (Web Speech API), com preferência por vozes femininas naturais em pt-PT.
 */

let voiceEnabled = true
let cachedVoice: SpeechSynthesisVoice | null = null

export function isVoiceSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

export function setVoiceEnabled(value: boolean) {
    voiceEnabled = value
    if (!value) stopSpeaking()
}

export function getVoiceEnabled(): boolean {
    return voiceEnabled
}

function pickVoice(): SpeechSynthesisVoice | null {
    if (!isVoiceSupported()) return null
    const voices = window.speechSynthesis.getVoices()
    if (!voices.length) return null

    const preferred = voices.filter((v) => {
        const name = `${v.name} ${v.lang ?? ''}`.toLowerCase()
        const langOk = (v.lang ?? '').toLowerCase().startsWith('pt') || (v.lang ?? '').toLowerCase().startsWith('en')
        const female = /female|woman|samantha|zira|voice2|jenny|aria|susan|catherine|sara|victoria|female/i.test(name)
        return langOk && (female || /pt|en/i.test(name))
    })

    const pt = voices.filter((v) => (v.lang ?? '').toLowerCase().startsWith('pt'))
    const femalePt = pt.filter((v) => /female|woman|mulher|samantha|zira|sara|jenny|aria|voice|feminina/i.test(`${v.name} ${v.lang}`.toLowerCase()))

    return (
        femalePt[0] ??
        preferred.find((v) => (v.lang ?? '').toLowerCase() === 'pt-pt') ??
        pt.find((v) => /portugal|pt-pt/i.test(`${v.name} ${v.lang}`)) ??
        pt[0] ??
        preferred[0] ??
        null
    )
}

/** Limpa markdown/emoji para uma leitura natural. */
function cleanForSpeech(text: string): string {
    return text
        .replace(/```[\s\S]*?```/g, ' bloco de código ')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/https?:\/\/\S+/g, ' endereço ')
        .replace(/[#*_>|]/g, ' ')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 700)
}

export function speak(text: string) {
    if (!voiceEnabled || !isVoiceSupported()) return
    const clean = cleanForSpeech(text)
    if (!clean) return
    try {
        const synth = window.speechSynthesis
        synth.cancel()
        const utterance = new SpeechSynthesisUtterance(clean)
        const voice = cachedVoice ?? pickVoice()
        if (voice) {
            cachedVoice = voice
            utterance.voice = voice
            utterance.lang = voice.lang
        } else {
            utterance.lang = 'pt-PT'
        }
        utterance.rate = 0.97
        utterance.pitch = 1.1
        utterance.volume = 1
        synth.speak(utterance)
    } catch { /* ignore */ }
}

export function stopSpeaking() {
    try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
        window.speechSynthesis.onvoiceschanged = () => { cachedVoice = pickVoice() }
        cachedVoice = pickVoice()
    } catch { /* ignore */ }
}
