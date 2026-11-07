import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/** Preferências de interface do proprietário, guardadas só neste browser. */

export type ThemeId = 'azul' | 'branco' | 'preto' | 'laranja'

export const THEMES: { id: ThemeId; label: string; short: string; swatch: string }[] = [
  { id: 'azul', label: 'Azul', short: 'Azul', swatch: '#3B82F6' },
  { id: 'branco', label: 'Branco', short: 'Branco', swatch: '#FFFFFF' },
  { id: 'preto', label: 'Preto fosco', short: 'Preto', swatch: '#0A0A0A' },
  { id: 'laranja', label: 'Laranja claro fosco', short: 'Laranja', swatch: '#E8A86C' },
]

type ChartTheme = {
  brand: string
  soft: string
  palette: string[]
  tip: { contentStyle: Record<string, string | number>; cursor: { fill: string } }
}

const NEUTRALS = ['#8B8F98', '#5C6068', '#3B3F46']

const CHART: Record<ThemeId, ChartTheme> = {
  azul: { brand: '#3B82F6', soft: '#60A5FA', palette: ['#3B82F6', '#60A5FA', '#8B8F98', '#5C6068', '#1D4ED8', ...NEUTRALS.slice(2)], tip: tip('#161B22', 'rgba(255,255,255,.1)', 'rgba(255,255,255,0.04)') },
  branco: { brand: '#18181B', soft: '#52525B', palette: ['#18181B', '#52525B', '#9CA3AF', '#D1D5DB', '#3F3F46', '#6B7280'], tip: tip('#FFFFFF', 'rgba(17,24,39,.12)', 'rgba(17,24,39,0.05)') },
  preto: { brand: '#E4E4E7', soft: '#FAFAFA', palette: ['#E4E4E7', '#A1A1AA', '#71717A', '#52525B', '#D4D4D8', '#3F3F46'], tip: tip('#141414', 'rgba(255,255,255,.1)', 'rgba(255,255,255,0.04)') },
  laranja: { brand: '#E8A86C', soft: '#F0C090', palette: ['#E8A86C', '#F0C090', '#8B8F98', '#5C6068', '#C98A4E', ...NEUTRALS.slice(2)], tip: tip('#201C18', 'rgba(255,255,255,.1)', 'rgba(255,255,255,0.04)') },
}

function tip(bg: string, border: string, cursor: string): ChartTheme['tip'] {
  return { contentStyle: { background: bg, border: `1px solid ${border}`, borderRadius: 10, fontSize: 12 }, cursor: { fill: cursor } }
}

const THEME_KEY = 'mkon.theme'
const FLOAT_KEY = 'mkon.sidebar.floating'

function readTheme(): ThemeId {
  try {
    const t = localStorage.getItem(THEME_KEY)
    if (t === 'azul' || t === 'branco' || t === 'preto' || t === 'laranja') return t
  } catch { /* ignore */ }
  return 'azul'
}

type Ctx = {
  theme: ThemeId
  setTheme: (t: ThemeId) => void
  floating: boolean
  setFloating: (v: boolean) => void
  chart: ChartTheme
}

const UiPrefs = createContext<Ctx | null>(null)

export function UiPrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(readTheme)
  const [floating, setFloatingState] = useState<boolean>(() => {
    try { return localStorage.getItem(FLOAT_KEY) === '1' } catch { return false }
  })

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t)
    try { localStorage.setItem(THEME_KEY, t) } catch { /* ignore */ }
  }, [])
  const setFloating = useCallback((v: boolean) => {
    setFloatingState(v)
    try { localStorage.setItem(FLOAT_KEY, v ? '1' : '0') } catch { /* ignore */ }
  }, [])

  const value = useMemo(() => ({ theme, setTheme, floating, setFloating, chart: CHART[theme] }), [theme, setTheme, floating, setFloating])
  return <UiPrefs.Provider value={value}>{children}</UiPrefs.Provider>
}

export function useUiPrefs() {
  const c = useContext(UiPrefs)
  if (!c) throw new Error('useUiPrefs fora do UiPrefsProvider')
  return c
}
