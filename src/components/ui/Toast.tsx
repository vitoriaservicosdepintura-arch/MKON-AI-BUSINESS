import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'error' | 'info' | 'warning'
type Toast = { id: number; tone: Tone; message: string }
const Ctx = createContext<{ push: (tone: Tone, message: string) => void }>({ push: () => {} })

export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((tone: Tone, message: string) => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s, { id, tone, message }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4500)
  }, [])
  const value = useMemo(() => ({ push }), [push])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {items.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertTriangle : t.tone === 'warning' ? AlertTriangle : Info
          return (
            <div key={t.id} className="card pointer-events-auto flex animate-fade-up items-start gap-2.5 px-3.5 py-3 text-sm">
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', t.tone === 'success' && 'text-emerald-400', t.tone === 'error' && 'text-red-400', t.tone === 'warning' && 'text-amber-400', t.tone === 'info' && 'text-brand')} />
              <span className="text-white/85">{t.message}</span>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}
