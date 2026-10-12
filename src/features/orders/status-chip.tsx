import { Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import { STATUS_META, type OrderStatus } from './api'

const tones: Record<OrderStatus, string> = {
  received: 'bg-brand-soft text-brand',
  in_process: 'bg-teal-soft text-teal-ink',
  ready: 'bg-pop-soft text-pop-ink',
  delivered: 'bg-ok-bg text-ok',
  cancelled: 'bg-off-bg text-off',
}

/** Estado de la orden: píldora con punto. "Lista" va en coral porque pide atención. */
export function StatusChip({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap',
        "before:size-2 before:rounded-full before:bg-current before:content-['']",
        tones[status],
        className,
      )}
    >
      {STATUS_META[status].label}
    </span>
  )
}

export function ExpressTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-pop px-2 py-0.5 text-2xs font-bold text-on-pop">
      <Zap size={12} aria-hidden /> Express
    </span>
  )
}

/** Código de estante o casillero. */
export function LocationTag({ location }: { location: string }) {
  if (!location) return <span className="text-muted">—</span>
  return <span className="tabular rounded-control bg-surface-2 px-2.5 py-1 text-sm font-bold shadow-[inset_0_0_0_1px_var(--line)]">{location}</span>
}
