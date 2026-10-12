import { cn } from '@/lib/cn'

/**
 * Ícono de uLaundry: una prenda colgada del tendedero (coral) con dos ondas de
 * agua. El coral es fijo (es la marca) y cambia de tono con el tema.
 */
export function BrandIcon({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('flex-none', className)} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <path d="M2 11h60" stroke="var(--logo-line, currentColor)" strokeOpacity=".45" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 6" fill="none" />
      <rect x="19" y="4" width="6" height="14" rx="3" fill="var(--logo-accent)" />
      <rect x="39" y="4" width="6" height="14" rx="3" fill="var(--logo-accent)" />
      <path d="M10 14h44v32a14 14 0 0 1-14 14H24a14 14 0 0 1-14-14Z" fill="var(--logo-accent)" />
      <path d="M19 31c4.3-4 8.7-4 13 0s8.700 4 13 0M19 42c4.3-4 8.7-4 13 0s8.700 4 13 0" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  )
}

const SIZES = {
  sm: { icon: 'size-5', text: 'text-[18px]', gap: 'gap-1.5' },
  md: { icon: 'size-7', text: 'text-[24px]', gap: 'gap-2' },
  lg: { icon: 'size-10', text: 'text-[34px]', gap: 'gap-2.5' },
} as const

/**
 * Logo completo: ícono + "uLaundry" ("u" coral, "Laundry" en tinta).
 * `onDark`: sobre fondos oscuros, "Laundry" va en blanco.
 */
export function Logo({
  size = 'md',
  onDark,
  iconOnly,
  className,
}: {
  size?: keyof typeof SIZES
  onDark?: boolean
  iconOnly?: boolean
  className?: string
}) {
  const s = SIZES[size]
  if (iconOnly) return <BrandIcon className={cn(s.icon, 'text-muted', className)} title="uLaundry" />
  return (
    <span className={cn('inline-flex items-center font-bold tracking-[-.02em]', s.gap, className)}>
      <BrandIcon className={cn(s.icon, onDark ? 'text-white' : 'text-muted')} />
      <span className={cn('leading-none', s.text)}>
        <span className="text-logo-accent">u</span>
        <span className={onDark ? 'text-white' : 'text-logo-ink'}>Laundry</span>
      </span>
    </span>
  )
}

export const TAGLINE = 'Cada orden, en su sitio.'
