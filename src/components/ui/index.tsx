import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ---------- Button ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
}
export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...p }: BtnProps) {
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variant === 'primary' && 'bg-brand text-on-brand hover:bg-brand-soft shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]',
        variant === 'ghost' && 'text-white/70 hover:bg-white/[0.06] hover:text-snow',
        variant === 'outline' && 'border border-white/10 text-snow hover:bg-white/[0.05]',
        variant === 'danger' && 'bg-red-500/90 text-[#ffffff] hover:bg-red-500',
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

/* ---------- Switch ---------- */
export function SwitchTrack({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden className={cn('relative block h-5 w-9 shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-brand' : 'bg-white/20')}>
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full shadow transition-all duration-200', checked ? 'left-[18px] bg-on-brand' : 'left-0.5 bg-[#ffffff]')} />
    </span>
  )
}
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50">
      <SwitchTrack checked={checked} />
    </button>
  )
}

/* ---------- Card ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card', className)}>{children}</div>
}
export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-white/40">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/* ---------- Badge ---------- */
const tones = {
  neutral: 'bg-white/[0.06] text-white/70',
  brand: 'bg-brand/15 text-brand-soft',
  success: 'bg-emerald-500/15 text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-300',
  danger: 'bg-red-500/15 text-red-300',
}
export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium', tones[tone])}>{children}</span>
}

/* ---------- Skeleton / Empty ---------- */
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton', className)} />

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-white/40">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('card relative z-10 flex max-h-[90vh] w-full animate-scale-in flex-col', wide ? 'max-w-2xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-white/50 hover:bg-white/[0.06] hover:text-snow">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------- Field ---------- */
export function Field({ label, children, hint }: { label?: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="mt-1 text-[11px] text-white/30">{hint}</p>}
    </div>
  )
}

/* ---------- Page header ---------- */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-white/45">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
