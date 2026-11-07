/**
 * Efeitos visuais globais: onda ao clicar em botões e links do menu.
 * Só visual (sem som). Respeita "reduzir movimento" do sistema.
 */

const TARGET = 'button, a[href], [role="button"], .nav-item'

function reduceMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function ripple(e: PointerEvent) {
  if (reduceMotion()) return
  const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(TARGET)
  if (!el || el.hasAttribute('disabled') || (el as HTMLButtonElement).disabled) return

  const rect = el.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height) * 1.6
  const span = document.createElement('span')
  span.className = 'mkon-ripple'
  span.style.width = span.style.height = `${size}px`
  span.style.left = `${e.clientX - rect.left - size / 2}px`
  span.style.top = `${e.clientY - rect.top - size / 2}px`

  const computed = getComputedStyle(el)
  if (computed.position === 'static') el.style.position = 'relative'
  if (computed.overflow === 'visible') el.style.overflow = 'hidden'

  el.appendChild(span)
  span.addEventListener('animationend', () => span.remove())
}

export function initEffects() {
  if (typeof window === 'undefined') return
  window.addEventListener('pointerdown', ripple, { passive: true })
}
