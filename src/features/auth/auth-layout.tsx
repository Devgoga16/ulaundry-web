import { BellRing, ScanLine, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo, TAGLINE } from '@/components/brand/logo'
import { cn } from '@/lib/cn'

/** Tendedero decorativo: una cuerda punteada con prendas colgadas. */
function Clothesline() {
  return (
    <svg viewBox="0 0 420 120" className="w-full" aria-hidden>
      <path d="M0 14 Q210 44 420 14" fill="none" stroke="var(--line-strong)" strokeWidth="2.5" strokeDasharray="9 8" strokeLinecap="round" />
      <g transform="rotate(-4 92 30)">
        <rect x="64" y="24" width="56" height="70" rx="6" fill="var(--teal)" />
        <rect x="74" y="16" width="7" height="16" rx="3.5" fill="var(--ink-2)" />
        <rect x="103" y="18" width="7" height="16" rx="3.5" fill="var(--ink-2)" />
      </g>
      <g transform="rotate(2 205 40)">
        <path d="M170 36h70v44a14 14 0 0 1-14 14h-42a14 14 0 0 1-14-14Z" fill="var(--pop)" />
        <rect x="182" y="27" width="7" height="16" rx="3.5" fill="var(--ink-2)" />
        <rect x="221" y="27" width="7" height="16" rx="3.5" fill="var(--ink-2)" />
      </g>
      <g transform="rotate(5 316 34)">
        <rect x="294" y="28" width="44" height="52" rx="6" fill="var(--teal-line)" />
        <rect x="302" y="20" width="7" height="16" rx="3.5" fill="var(--ink-2)" />
        <rect x="323" y="19" width="7" height="16" rx="3.5" fill="var(--ink-2)" />
      </g>
    </svg>
  )
}

/** Pantalla dividida: marca a la izquierda (desde tablet), formulario a la derecha. */
export function AuthLayout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <aside className="hidden flex-col justify-between border-r border-line bg-surface p-10 lg:flex">
        <Link to="/" aria-label="uLaundry, inicio" className="flex flex-col gap-2 self-start no-underline">
          <Logo size="lg" />
          <span className="text-sm text-muted">{TAGLINE}</span>
        </Link>
        <div className="flex flex-col gap-7">
          <Clothesline />
          <h1 className="m-0 text-3xl leading-[1.1] font-bold tracking-[-.02em] text-ink">
            Recibe, lava, avisa y entrega <span className="text-teal-ink">sin perder una sola prenda.</span>
          </h1>
          <ul className="m-0 flex list-none flex-col gap-3.5 p-0 text-md text-ink-2">
            {(
              [
                [ScanLine, 'Cada orden con su ticket y su ubicación'],
                [BellRing, 'Aviso por WhatsApp cuando la ropa está lista'],
                [Wallet, 'El saldo por cobrar siempre a la vista'],
              ] as const
            ).map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid size-10 flex-none place-items-center rounded-tile bg-teal-soft text-teal-ink">
                  <Icon size={19} aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-muted">Unify Tec · Hecho en Perú</div>
      </aside>
      <main className="flex items-start justify-center px-4 py-10 sm:items-center">
        <div className={cn('w-full', wide ? 'max-w-[880px]' : 'max-w-[420px]')}>
          <Link to="/" aria-label="uLaundry, inicio" className="mb-6 flex justify-center no-underline lg:hidden">
            <Logo size="md" />
          </Link>
          {children}
        </div>
      </main>
    </div>
  )
}

/** Mensaje de error de formulario (fuera de un campo). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-control bg-bad-bg px-3 py-2.5 text-sm font-semibold text-bad">
      {message}
    </div>
  )
}
