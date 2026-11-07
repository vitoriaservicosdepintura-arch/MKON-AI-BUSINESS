/**
 * Preferências de interface persistidas: efeitos sonoros e menu flutuante.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setSfxEnabled } from './sfx'

const SOUND_KEY = 'mkon.ui.sound'
const FLOATING_KEY = 'mkon.ui.floating'

function readFlag(key: string, fallback: boolean): boolean {
    try {
        const raw = localStorage.getItem(key)
        return raw === null ? fallback : raw === '1'
    } catch {
        return fallback
    }
}

function writeFlag(key: string, value: boolean) {
    try { localStorage.setItem(key, value ? '1' : '0') } catch { /* ignore */ }
}

type UiPrefs = {
    sound: boolean
    floating: boolean
    toggleSound: () => void
    toggleFloating: () => void
}

const Ctx = createContext<UiPrefs>({
    sound: true,
    floating: true,
    toggleSound: () => { },
    toggleFloating: () => { },
})

export const useUiPrefs = () => useContext(Ctx)

export function UiPrefsProvider({ children }: { children: ReactNode }) {
    const [sound, setSound] = useState(() => readFlag(SOUND_KEY, true))
    const [floating, setFloating] = useState(() => readFlag(FLOATING_KEY, true))

    useEffect(() => {
        setSfxEnabled(sound)
    }, [sound])

    const toggleSound = useCallback(() => {
        setSound((v) => {
            const next = !v
            writeFlag(SOUND_KEY, next)
            return next
        })
    }, [])

    const toggleFloating = useCallback(() => {
        setFloating((v) => {
            const next = !v
            writeFlag(FLOATING_KEY, next)
            return next
        })
    }, [])

    const value = useMemo(() => ({ sound, floating, toggleSound, toggleFloating }), [sound, floating, toggleSound, toggleFloating])

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
