import { History, House, LifeBuoy, LogOut, MessageCircle, Moon, Receipt, Shirt, Store, Sun, Truck, UserRound, Wallet, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/display'
import { Field, Input } from '@/components/ui/field'
import { OrgLogo } from '@/components/ui/org-logo'
import { ApiError, errorMessage } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/theme'
import { isSessionExpired, openPortalSession, portalSession, prettyPhone, requestPortalCode, useBusiness, usePortalAccount, usePortalOrders, type PublicBusiness } from './api'
import { HelpTab, usePortalHelp } from './help-tab'
import { HistoryTab, HomeTab, PaymentsTab } from './orders-tabs'
import { ProfileTab } from './profile-tab'

const TABS = [
  { value: 'inicio', label: 'Inicio', icon: House },
  { value: 'historial', label: 'Historial', icon: History },
  { value: 'pagos', label: 'Pagos', icon: Receipt },
  { value: 'ayuda', label: 'Ayuda', icon: LifeBuoy },
  { value: 'perfil', label: 'Mis datos', icon: UserRound },
] as const satisfies ReadonlyArray<{ value: string; label: string; icon: LucideIcon }>
type Tab = (typeof TABS)[number]['value']

const headerButton = 'grid size-10 flex-none cursor-pointer place-items-center rounded-full bg-[color-mix(in_oklab,var(--on-grad)_16%,transparent)] hover:bg-[color-mix(in_oklab,var(--on-grad)_26%,transparent)]'

function ThemeToggle() {
  const { resolved, setPreference } = useTheme()
  const dark = resolved === 'dark'
  return (
    <button type="button" onClick={() => setPreference(dark ? 'light' : 'dark')} aria-label={dark ? 'Usar modo claro' : 'Usar modo oscuro'} className={headerButton}>
      {dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
    </button>
  )
}

/** Marco del portal: el negocio arriba, las secciones como pestañas (abajo en el celular). */
function PortalFrame({
  business,
  title,
  subtitle,
  actions,
  tab,
  badges,
  children,
}: {
  business?: PublicBusiness
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  /** Sin pestaña activa (antes de entrar) no se muestra la navegación. */
  tab?: Tab
  /** Avisos por pestaña (p. ej. respuestas sin leer en Ayuda). */
  badges?: Partial<Record<Tab, number>>
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-bg pb-24 sm:pb-12">
      <header className="bg-grad">
        <div className={cn('mx-auto flex max-w-[960px] items-center gap-3.5 px-4 pt-6', tab ? 'pb-[76px]' : 'pb-16')}>
          <OrgLogo
            name={business?.name ?? title}
            logoUrl={business?.logoUrl}
            className="size-12 flex-none rounded-tile bg-[color-mix(in_oklab,var(--on-grad)_18%,transparent)] text-lg font-semibold"
          />
          <div className="min-w-0 flex-1">
            <h1 className="m-0 truncate text-xl font-bold">{title}</h1>
            {subtitle && <div className="truncate text-sm opacity-90">{subtitle}</div>}
          </div>
          {actions}
          <ThemeToggle />
        </div>
      </header>

      <div className={cn('mx-auto flex max-w-[960px] flex-col gap-4 px-4', tab ? '-mt-[52px]' : '-mt-10')}>
        {tab && (
          <nav aria-label="Secciones del portal" className="hidden gap-1 rounded-card bg-surface p-1.5 shadow-card sm:flex">
            {TABS.map(({ value, label, icon: Icon }) => (
              <Link
                key={value}
                to={`?tab=${value}`}
                aria-current={value === tab ? 'page' : undefined}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-tile px-3 py-2.5 text-sm font-semibold no-underline transition-colors',
                  value === tab ? 'bg-brand-soft text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden /> {label}
                {!!badges?.[value] && <span className="rounded-full bg-pop-soft px-1.5 text-2xs font-bold text-pop-ink">{badges[value]}</span>}
              </Link>
            ))}
          </nav>
        )}
        {children}
        {!business?.whiteLabel && (
          <footer className="flex items-center justify-center gap-1.5 pt-4 text-sm text-muted">
            Hecho con <Logo size="sm" />
          </footer>
        )}
      </div>

      {tab && (
        <nav aria-label="Secciones del portal" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface px-1 pt-1 pb-[max(4px,env(safe-area-inset-bottom))] sm:hidden">
          {TABS.map(({ value, label, icon: Icon }) => (
            <Link
              key={value}
              to={`?tab=${value}`}
              aria-current={value === tab ? 'page' : undefined}
              className={cn('flex flex-1 flex-col items-center gap-0.5 rounded-control py-1.5 text-[11.5px] font-semibold no-underline', value === tab ? 'text-brand' : 'text-muted')}
            >
              <span className="relative">
                <Icon size={21} strokeWidth={value === tab ? 2.1 : 1.7} aria-hidden />
                {!!badges?.[value] && <span className="absolute -top-1 -right-1.5 size-2.5 rounded-full bg-pop" aria-label={`${badges[value]} sin leer`} />}
              </span>
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

/** Entrar: celular → código de 6 dígitos que llega por WhatsApp. */
function SignIn({ slug, businessName, onSignedIn }: { slug: string; businessName: string; onSignedIn: (session: { token: string; phone: string }) => void }) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const digits = phone.replace(/\D/g, '')

  const send = async () => {
    setError(null)
    if (!/^9\d{8}$/.test(digits)) return setError('Escribe tu celular de 9 dígitos, empezando con 9')
    setBusy(true)
    try {
      await requestPortalCode(slug, digits)
      setSentTo(digits)
      setCode('')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setError(null)
    if (!/^\d{6}$/.test(code)) return setError('El código tiene 6 dígitos')
    setBusy(true)
    try {
      onSignedIn(await openPortalSession(slug, sentTo!, code))
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Card className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10 md:p-8">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void (sentTo ? verify() : send())
        }}
      >
        <div>
          <h2 className="m-0 text-2xl font-bold">{sentTo ? 'Revisa tu WhatsApp' : 'Mira cómo va tu ropa'}</h2>
          <p className="mt-1.5 mb-0 text-body text-muted">
            {sentTo
              ? `Si el ${prettyPhone(sentTo)} tiene órdenes en ${businessName}, te llegó un código de 6 dígitos. Vence en 10 minutos.`
              : `Usa el celular que dejaste en ${businessName}. Te enviamos un código por WhatsApp; no necesitas contraseña.`}
          </p>
        </div>
        {sentTo ? (
          <Field label="Código de 6 dígitos">
            {(p) => (
              <Input
                {...p}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                autoFocus
                className="max-w-[240px] py-3 text-center text-xl tracking-[.4em]"
              />
            )}
          </Field>
        ) : (
          <Field label="Celular">
            {(p) => (
              <Input {...p} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" autoComplete="tel-national" placeholder="987 654 321" autoFocus className="max-w-[280px] py-3 text-lg" />
            )}
          </Field>
        )}
        {error && (
          <p role="alert" className="m-0 text-sm font-semibold text-bad">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button type="submit" variant="primary" disabled={busy} className="px-5 py-3 text-md">
            <MessageCircle size={17} aria-hidden /> {busy ? 'Un momento…' : sentTo ? 'Entrar' : 'Enviarme el código'}
          </Button>
          {sentTo && (
            <>
              <Button variant="ghost" disabled={busy} onClick={() => void send()}>
                Reenviar
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => (setSentTo(null), setError(null))}>
                Cambiar celular
              </Button>
            </>
          )}
        </div>
        <p className="m-0 text-sm text-muted">¿Primera vez? Tu cuenta se crea sola cuando dejas ropa y das tu celular en el local.</p>
        <p className="m-0 text-sm text-muted">
          Tus datos los administra la lavandería.{' '}
          <Link to="/privacidad" target="_blank" className="font-semibold text-brand hover:underline">
            Política de privacidad
          </Link>
        </p>
      </form>

      <ul className="m-0 flex list-none flex-col justify-center gap-4 rounded-card bg-surface-2 p-5">
        {(
          [
            [Shirt, 'Sigue cada orden', 'Recibida, en proceso o lista para recoger: lo ves al momento.'],
            [Wallet, 'Tu saldo siempre a la vista', 'Cuánto debes y cómo pagarlo con Yape, Plin o transferencia.'],
            [Truck, 'Pide que pasen por tu ropa', 'Si la lavandería hace recojos, lo pides desde aquí.'],
            [LifeBuoy, 'Pregunta sin llamar', 'Escríbele a la lavandería sobre tu orden y te responden aquí.'],
          ] as Array<[LucideIcon, string, string]>
        ).map(([Icon, title, text]) => (
          <li key={title} className="flex items-start gap-3">
            <span className="grid size-10 flex-none place-items-center rounded-full bg-brand-soft text-brand">
              <Icon size={18} aria-hidden />
            </span>
            <span className="text-body">
              <b className="block font-semibold">{title}</b>
              <span className="text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** /portal/:slug — portal del cliente de una lavandería. */
export function PortalPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [params] = useSearchParams()
  const business = useBusiness(slug)
  const [session, setSession] = useState(() => portalSession.get(slug))
  const account = usePortalAccount(slug, session?.token ?? null)
  const orders = usePortalOrders(slug, session?.token ?? null)
  const help = usePortalHelp(slug, session?.token ?? null)

  const requested = params.get('tab')
  const tab: Tab = TABS.find((t) => t.value === requested)?.value ?? 'inicio'

  const signOut = () => {
    portalSession.clear(slug)
    setSession(null)
  }

  // Sesión vencida: vuelve a pedir el celular.
  const expired = isSessionExpired(account.error) || isSessionExpired(orders.error)
  useEffect(() => {
    if (!expired) return
    portalSession.clear(slug)
    setSession(null)
  }, [expired, slug])
  useEffect(() => {
    if (business.data) document.title = `${business.data.name} · Mi ropa`
  }, [business.data])

  const b = business.data
  if (business.isLoading) {
    return (
      <PortalFrame title="Mi ropa">
        <Skeleton className="h-[360px] rounded-card" />
      </PortalFrame>
    )
  }
  if (!b || !b.portalEnabled) {
    return (
      <PortalFrame business={b} title={b?.name ?? 'Mi ropa'}>
        <Card>
          <EmptyState
            icon={Store}
            title={b ? 'Esta lavandería aún no tiene portal de clientes' : 'Página no disponible'}
            description={b ? 'Consulta por tu ropa directamente en el local con tu número de ticket.' : business.error instanceof ApiError && business.error.status !== 404 ? business.error.message : 'Revisa que el enlace esté completo.'}
          />
        </Card>
      </PortalFrame>
    )
  }

  if (!session) {
    return (
      <PortalFrame business={b} title={b.name} subtitle="Portal de clientes">
        <SignIn
          slug={slug}
          businessName={b.name}
          onSignedIn={(s) => {
            const next = { token: s.token, phone: s.phone }
            portalSession.set(slug, next)
            setSession(next)
          }}
        />
      </PortalFrame>
    )
  }

  const a = account.data
  const holder = a?.profiles[0]
  const frame = (children: ReactNode) => (
    <PortalFrame
      business={b}
      title={b.name}
      subtitle={holder ? `Hola, ${holder.firstName}` : 'Portal de clientes'}
      tab={tab}
      badges={{ ayuda: help.data?.unread }}
      actions={
        <button type="button" onClick={signOut} aria-label="Cerrar sesión" className={headerButton}>
          <LogOut size={17} aria-hidden />
        </button>
      }
    >
      {children}
    </PortalFrame>
  )

  if (!a || !orders.data) {
    const failed = (account.isError || orders.isError) && !expired
    return frame(
      failed ? (
        <Card>
          <p className="m-0 text-sm font-semibold text-bad">{errorMessage(account.error ?? orders.error)}</p>
        </Card>
      ) : (
        <>
          <Skeleton className="h-[220px] rounded-card" />
          <Skeleton className="h-[160px] rounded-card" />
        </>
      ),
    )
  }

  return frame(
    <>
      {tab === 'inicio' && <HomeTab slug={slug} token={session.token} account={a} orders={orders.data} business={b} />}
      {tab === 'historial' && <HistoryTab account={a} orders={orders.data} />}
      {tab === 'pagos' && <PaymentsTab slug={slug} token={session.token} account={a} orders={orders.data} business={b} />}
      {tab === 'ayuda' && <HelpTab slug={slug} token={session.token} business={b} />}
      {tab === 'perfil' && <ProfileTab key={a.profiles.map((p) => p.id).join()} slug={slug} token={session.token} account={a} businessName={b.name} onSignOut={signOut} />}
    </>,
  )
}
