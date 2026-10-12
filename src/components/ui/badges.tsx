import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type TagTone = 'brand' | 'teal' | 'pop' | 'bad' | 'warn' | 'ok' | 'off'

const tagTones: Record<TagTone, string> = {
  brand: 'bg-brand-soft text-brand',
  teal: 'bg-teal-soft text-teal-ink',
  pop: 'bg-pop-soft text-pop-ink',
  bad: 'bg-bad-bg text-bad',
  warn: 'bg-warn-bg text-warn',
  ok: 'bg-ok-bg text-ok',
  off: 'bg-off-bg text-off',
}

/** Etiqueta rectangular (VIP, Nuevo, Activo…). */
export function Tag({
  tone = 'brand',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: TagTone }) {
  return (
    <span
      className={cn(
        'inline-block rounded-[6px] px-2 py-0.5 text-2xs font-semibold whitespace-nowrap',
        tagTones[tone],
        className,
      )}
      {...props}
    />
  )
}

/** Píldora con borde sutil para metadatos (6.5 kg · S/ 26). */
export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] rounded-[6px] bg-surface-2 px-2 py-[3px] text-2xs font-semibold shadow-[inset_0_0_0_1px_var(--line)]',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('whitespace-nowrap rounded-[5px] border border-line-strong px-[5px] py-px font-sans text-2xs text-muted', className)}>
      {children}
    </kbd>
  )
}
