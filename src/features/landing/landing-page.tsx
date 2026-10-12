import {
  ArrowRight,
  BellRing,
  Camera,
  ChartColumn,
  Check,
  HandCoins,
  History,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  PackageCheck,
  Printer,
  ShieldCheck,
  Shirt,
  Store,
  Sun,
  Tag,
  Truck,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/brand/logo'
import { formatPlanPrice, planHighlights, usePlans } from '@/features/auth/plans'
import { useAuth } from '@/lib/auth/auth-context'
import { homeFor } from '@/lib/auth/home'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/theme'

/* ---------- Piezas ---------- */

/** Captura real de la app. Hay una versión por tema y se muestra la que corresponde. */
function Shot({ name, alt, className, eager }: { name: string; alt: string; className?: string; eager?: boolean }) {
  const loading = eager ? 'eager' : 'lazy'
  return (
    <>
      <img src={`/landing/${name}.webp`} alt={alt} loading={loading} decoding="async" className={cn('block w-full dark:hidden', className)} />
      <img src={`/landing/${name}-dark.webp`} alt={alt} loading={loading} decoding="async" className={cn('hidden w-full dark:block', className)} />
    </>
  )
}

/** Marco de navegador alrededor de una captura de escritorio. */
function BrowserFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-panel border border-line-strong bg-surface shadow-pop', className)}>
      <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-3.5 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
      </div>
      {children}
    </div>
  )
}

/** Marco de celular alrededor de una captura móvil. */
function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-[30px] border-[7px] border-ink bg-surface shadow-pop', className)}>{children}</div>
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="m-0 text-sm font-bold tracking-[.12em] text-teal-ink uppercase">{children}</p>
}

function SectionTitle({ eyebrow, title, text, center }: { eyebrow: string; title: ReactNode; text?: string; center?: boolean }) {
  return (
    <div className={cn('max-w-[640px]', center && 'mx-auto text-center')}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="m-0 mt-2 text-[clamp(28px,4vw,40px)] leading-[1.08] font-bold tracking-[-.025em]">{title}</h2>
      {text && <p className="m-0 mt-3.5 text-lg leading-relaxed text-ink-2">{text}</p>}
    </div>
  )
}

const cta = 'bg-grad inline-flex items-center justify-center gap-2 rounded-control px-6 py-3.5 text-md font-semibold no-underline hover:brightness-110'
const ctaGhost = 'inline-flex items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-6 py-3.5 text-md font-semibold text-ink no-underline hover:border-teal'

/** Mensaje de WhatsApp tal como lo envía uLaundry (mismo texto que usa la API). */
function WhatsAppBubble({ time, children }: { time: string; children: ReactNode }) {
  return (
    <div className="max-w-[330px] rounded-[14px] rounded-tl-[4px] bg-surface px-3.5 py-2.5 text-body leading-snug shadow-card">
      <div className="whitespace-pre-line">{children}</div>
      <div className="mt-1 text-right text-xs text-muted">{time}</div>
    </div>
  )
}

/* ---------- Contenido ---------- */

const STEPS: Array<{ n: string; title: string; text: string }> = [
  { n: '1', title: 'Recibe', text: 'Eliges al cliente, pesas o cuentas, anotas las manchas con foto y cobras el adelanto. El ticket sale con su número.' },
  { n: '2', title: 'Lava y ubica', text: 'La orden pasa a proceso y, cuando está lista, anotas el estante o casillero donde la dejas.' },
  { n: '3', title: 'Avisa', text: 'Al cliente le llega un WhatsApp cuando recibes su ropa y otro cuando ya puede recogerla.' },
  { n: '4', title: 'Entrega y cobra', text: 'Buscas por ticket, nombre, celular o ubicación. Si hay saldo, te lo recuerda antes de entregar.' },
]

const FEATURES: Array<{ icon: LucideIcon; title: string; text: string; plan?: 'Pro' | 'Business' }> = [
  { icon: Shirt, title: 'Por kilo, por prenda o por pieza', text: 'Cada servicio con su precio normal y su precio express. Edredones, ternos y cortinas incluidos.' },
  { icon: Printer, title: 'Ticket imprimible', text: 'En térmica de 80 mm o en hoja A4, con tus datos de pago y tus condiciones al pie.' },
  { icon: MapPin, title: 'Ubicación de cada orden', text: 'Estante o casillero anotado al terminar, para encontrarla en segundos.' },
  { icon: Wallet, title: 'Saldo siempre visible', text: 'Adelanto, pagos en partes y saldo pendiente en la lista, en la orden y en el ticket.' },
  { icon: Camera, title: 'Fotos de manchas y daños', text: 'Quedan guardadas en la orden por si hay un reclamo.' },
  { icon: HandCoins, title: 'Caja del día', text: 'Cobros por efectivo, Yape, Plin y transferencia, salidas de efectivo y cierre con la diferencia.' },
  { icon: PackageCheck, title: 'Órdenes no recogidas', text: 'Sabes cuáles llevan días esperando y cuáles ya pasaron tu plazo.' },
  { icon: BellRing, title: 'Recordatorios automáticos', text: 'Si no recogen, el sistema vuelve a avisar por WhatsApp según las reglas que pongas.', plan: 'Pro' },
  { icon: Truck, title: 'Recojo y entrega a domicilio', text: 'Con dirección, franja horaria, costo y repartidor asignado, que ve solo sus repartos.', plan: 'Pro' },
  { icon: Tag, title: 'Promociones', text: 'Porcentaje o monto fijo, por días, por servicios o para la primera orden.', plan: 'Pro' },
  { icon: ChartColumn, title: 'Reportes del rubro', text: 'Kilos procesados, tiempos de entrega e ingresos por servicio y medio de pago.', plan: 'Pro' },
  { icon: ShieldCheck, title: 'Roles y permisos', text: 'Recepción, operario y repartidor de fábrica; en Pro creas los tuyos.' },
  { icon: Store, title: 'Varias sucursales', text: 'Cada sede con su numeración de tickets, su caja y su equipo.', plan: 'Pro' },
  { icon: MessageCircle, title: 'Portal del cliente', text: 'Tu cliente ve su orden y su saldo, y te escribe sus dudas, desde su celular.', plan: 'Pro' },
  { icon: History, title: 'Auditoría', text: 'Quién registró, cobró, anuló o cambió algo, y cuándo.', plan: 'Business' },
]

const FAQ: Array<{ q: string; a: string }> = [
  { q: '¿Tengo que instalar algo?', a: 'No. uLaundry funciona en el navegador de tu computadora, tablet o celular. Entras con tu correo y tu contraseña.' },
  { q: '¿Qué impresora necesito para el ticket?', a: 'Cualquiera que ya imprima desde tu navegador. El ticket viene en dos formatos: térmica de 80 mm y hoja A4.' },
  { q: '¿Cómo cobro con Yape o Plin?', a: 'uLaundry no procesa pagos: tú cobras como siempre y registras el pago con su medio, el número de operación y, si quieres, la foto del comprobante. Así cuadra la caja.' },
  { q: '¿Desde qué número llegan los avisos de WhatsApp?', a: 'Salen desde el número de uLaundry, con el nombre de tu lavandería y el número de ticket en el mensaje.' },
  { q: '¿Qué pasa cuando terminan los 30 días de prueba?', a: 'Tu cuenta queda en solo lectura: puedes consultar todo, pero no registrar. Eliges un plan, pagas por Yape o transferencia, subes el comprobante y lo activamos.' },
  { q: '¿Puedo cambiar de plan después?', a: 'Sí, cuando quieras. Lo que tenías registrado se conserva.' },
]

/* ---------- Página ---------- */

function Header() {
  const { status, me } = useAuth()
  const { resolved, setPreference } = useTheme()
  const [open, setOpen] = useState(false)
  const dark = resolved === 'dark'
  const links = [
    ['#como-funciona', 'Cómo funciona'],
    ['#funciones', 'Funciones'],
    ['#portal', 'Portal del cliente'],
    ['#planes', 'Planes'],
  ] as const
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1160px] items-center gap-4 px-4 py-3.5">
        <a href="#inicio" aria-label="uLaundry, inicio" className="no-underline">
          <Logo size="md" />
        </a>
        <nav aria-label="Secciones" className="ml-6 hidden gap-6 lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="text-body font-semibold text-ink-2 no-underline hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <button type="button" onClick={() => setPreference(dark ? 'light' : 'dark')} aria-label={dark ? 'Usar modo claro' : 'Usar modo oscuro'} className="grid size-10 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-surface-2">
            {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          </button>
          {status === 'authenticated' && me ? (
            <Link to={homeFor(me)} className={cn(cta, 'px-4 py-2.5 text-body')}>
              Ir a mi panel
            </Link>
          ) : (
            <>
              <Link to="/login" className="hidden px-2 text-body font-semibold text-ink no-underline hover:underline sm:block">
                Iniciar sesión
              </Link>
              <Link to="/registro" className={cn(cta, 'whitespace-nowrap px-4 py-2.5 text-body')}>
                Prueba gratis
              </Link>
            </>
          )}
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} className="grid size-10 cursor-pointer place-items-center rounded-full text-ink hover:bg-surface-2 lg:hidden">
            {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Secciones" className="flex flex-col border-t border-line px-4 py-2 lg:hidden">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="py-3 text-md font-semibold text-ink no-underline">
              {label}
            </a>
          ))}
          <Link to="/login" className="py-3 text-md font-semibold text-ink no-underline sm:hidden">
            Iniciar sesión
          </Link>
        </nav>
      )}
    </header>
  )
}

function Pricing() {
  const { data: plans, isLoading } = usePlans()
  const [yearly, setYearly] = useState(false)
  return (
    <section id="planes" className="scroll-mt-20 px-4 py-20">
      <div className="mx-auto max-w-[1160px]">
        <SectionTitle center eyebrow="Planes" title="30 días gratis en el plan que elijas. Sin tarjeta." text="Precios en soles, por lavandería. Pagas por Yape o transferencia y puedes cambiar de plan cuando quieras." />
        <div className="mt-7 flex justify-center">
          <div className="inline-flex rounded-full border border-line-strong bg-surface p-1" role="group" aria-label="Periodo de pago">
            {(
              [
                [false, 'Mensual'],
                [true, 'Anual · 2 meses gratis'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={yearly === value}
                onClick={() => setYearly(value)}
                className={cn('cursor-pointer rounded-full px-4 py-2 text-body font-semibold', yearly === value ? 'bg-ink text-surface' : 'text-ink-2')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="mt-10 text-center text-muted">Cargando planes…</p>
        ) : !plans?.length ? (
          <p className="mt-10 text-center text-muted">
            No pudimos cargar los planes ahora.{' '}
            <Link to="/registro" className="font-semibold text-brand">
              Crea tu cuenta
            </Link>{' '}
            y elígelo al registrarte.
          </p>
        ) : (
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => {
              const featured = plan.code === 'pro'
              const price = yearly ? plan.price.yearly : plan.price.monthly
              return (
                <article key={plan.id} className={cn('relative flex flex-col rounded-panel bg-surface p-7', featured ? 'border-2 border-teal shadow-pop' : 'border border-line-strong shadow-card')}>
                  {featured && <span className="absolute -top-3.5 left-7 rounded-full bg-pop px-3 py-1 text-sm font-bold text-on-pop">Recomendado</span>}
                  <h3 className="m-0 text-2xl font-bold">{plan.name}</h3>
                  <p className="m-0 mt-1.5 min-h-[3em] text-body text-ink-2">{plan.description}</p>
                  <p className="m-0 mt-5">
                    <span className="tabular text-[44px] leading-none font-bold tracking-[-.03em]">{formatPlanPrice(price, plan.price.currency)}</span>
                    <span className="text-md text-muted"> / {yearly ? 'año' : 'mes'}</span>
                  </p>
                  <p className="m-0 mt-1 text-sm text-muted">{yearly ? `Equivale a ${formatPlanPrice(Math.round(plan.price.yearly / 12), plan.price.currency)} al mes` : `o ${formatPlanPrice(plan.price.yearly, plan.price.currency)} al año`}</p>
                  <Link to={`/registro?plan=${plan.code}`} className={cn(featured ? cta : ctaGhost, 'mt-6')}>
                    Empezar gratis
                  </Link>
                  <ul className="m-0 mt-6 flex list-none flex-col gap-2.5 p-0">
                    {planHighlights(plan).map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-body">
                        <Check size={18} aria-hidden className="mt-0.5 flex-none text-teal-ink" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

/** Landing pública de uLaundry. Todo lo que muestra existe en el producto; las capturas son de la app real con datos de ejemplo. */
export function LandingPage() {
  useEffect(() => {
    document.title = 'uLaundry · Cada orden, en su sitio.'
  }, [])

  return (
    <div id="inicio" className="min-h-screen bg-bg text-ink">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-14 pb-10 sm:pt-20">
        <div className="glow pointer-events-none absolute inset-0 opacity-70" aria-hidden />
        <div className="relative mx-auto max-w-[1160px]">
          <div className="mx-auto max-w-[820px] text-center">
            <Eyebrow>Software para lavanderías en Perú</Eyebrow>
            <h1 className="m-0 mt-3 text-[clamp(40px,7vw,76px)] leading-[.98] font-bold tracking-[-.04em]">
              Cada orden, <span className="text-teal-ink">en su sitio.</span>
            </h1>
            <p className="mx-auto mt-5 mb-0 max-w-[600px] text-xl leading-relaxed text-ink-2">Recibe la ropa, avisa por WhatsApp cuando está lista y entrega sabiendo siempre dónde está cada bolsa y cuánto falta cobrar.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/registro" className={cta}>
                Probar 30 días gratis <ArrowRight size={18} aria-hidden />
              </Link>
              <a href="#como-funciona" className={ctaGhost}>
                Ver cómo funciona
              </a>
            </div>
            <p className="m-0 mt-4 text-sm text-muted">Sin tarjeta y sin instalar nada. En soles, con Yape y Plin.</p>
          </div>

          <div className="relative mx-auto mt-12 max-w-[1040px]">
            <BrowserFrame>
              <Shot name="ordenes" eager alt="Pantalla de órdenes de uLaundry: cifras del día, filtros por estado y la lista con ticket, cliente, estado, ubicación y saldo." />
            </BrowserFrame>
            <PhoneFrame className="absolute -right-2 -bottom-8 hidden w-[210px] md:block lg:-right-10">
              <Shot name="orden-movil" eager alt="Ficha de una orden en el celular, con su estado y su saldo por cobrar." />
            </PhoneFrame>
          </div>
          <p className="m-0 mt-12 text-center text-sm text-muted">Capturas reales de uLaundry con datos de ejemplo.</p>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="scroll-mt-20 px-4 py-20">
        <div className="mx-auto max-w-[1160px]">
          <SectionTitle eyebrow="Cómo funciona" title="El mismo recorrido de siempre, sin el cuaderno." text="La orden avanza entera por cuatro pasos. En cada uno, lo siguiente que toca hacer está a un toque." />
          <ol className="m-0 mt-10 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className="rounded-card bg-surface p-5 shadow-card">
                <span className="grid size-10 place-items-center rounded-full bg-teal text-md font-bold text-on-teal">{step.n}</span>
                <h3 className="m-0 mt-3.5 text-lg font-bold">{step.title}</h3>
                <p className="m-0 mt-1.5 text-body text-ink-2">{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-14 grid items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <BrowserFrame>
              <Shot name="nueva-orden" alt="Formulario de nueva orden: cliente, servicios con cantidad y subtotal, entrega express, observaciones y cobro." />
            </BrowserFrame>
            <div>
              <h3 className="m-0 text-2xl leading-tight font-bold tracking-[-.02em]">Registrar una orden toma menos que llenar el talonario.</h3>
              <ul className="m-0 mt-5 flex list-none flex-col gap-3.5 p-0 text-md text-ink-2">
                {[
                  'Busca al cliente por nombre o celular, o regístralo ahí mismo.',
                  'El precio sale del catálogo; el express cambia precio y plazo con un interruptor.',
                  'La fecha prometida se calcula sola con tus plazos.',
                  'Cobras todo, la mitad o nada: el saldo se actualiza mientras escribes.',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <Check size={20} aria-hidden className="mt-0.5 flex-none text-teal-ink" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-16 grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <div className="order-2 lg:order-1">
              <h3 className="m-0 text-2xl leading-tight font-bold tracking-[-.02em]">Una ficha por orden, con la siguiente acción a la mano.</h3>
              <ul className="m-0 mt-5 flex list-none flex-col gap-3.5 p-0 text-md text-ink-2">
                {[
                  'Los cuatro pasos a la vista: recibida, en proceso, lista y entregada.',
                  'El saldo por cobrar arriba, grande, y en coral cuando hay deuda.',
                  'Ubicación del estante o casillero, y fotos de las observaciones.',
                  'Historial de quién la registró, la movió y la cobró.',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <Check size={20} aria-hidden className="mt-0.5 flex-none text-teal-ink" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <BrowserFrame className="order-1 lg:order-2">
              <Shot name="orden" alt="Ficha de una orden lista: pasos, ubicación, saldo por cobrar, botones para entregar, cobrar e imprimir el ticket." />
            </BrowserFrame>
          </div>
        </div>
      </section>

      {/* WhatsApp + ticket */}
      <section className="bg-surface px-4 py-20">
        <div className="mx-auto grid max-w-[1160px] items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionTitle eyebrow="Avisos por WhatsApp" title="Tu cliente se entera sin que nadie llame." text="El aviso sale solo al registrar la orden y al marcarla lista. Incluido en todos los planes." />
            <div className="mt-7 flex flex-col gap-3 rounded-panel bg-teal-soft p-5">
              <WhatsAppBubble time="3:38 p. m.">{'Hola Carmen, recibimos tu ropa en Lavandería Burbujas.\nTicket: M-00001\nTotal: S/ 39.00 · Saldo por pagar: S/ 20.00\nEstará lista: lun, 12 oct, 3:38 p. m.'}</WhatsAppBubble>
              <WhatsAppBubble time="11:05 a. m.">{'Hola Carmen, tu orden M-00001 ya está lista para recoger en Lavandería Burbujas (Av. Larco 812, Miraflores).\nSaldo por pagar: S/ 20.00'}</WhatsAppBubble>
              <WhatsAppBubble time="10:00 a. m.">{'Hola Carmen, tu orden M-00001 te espera en Lavandería Burbujas (Av. Larco 812, Miraflores) desde hace 3 días.\nSaldo por pagar: S/ 20.00'}</WhatsAppBubble>
            </div>
            <p className="m-0 mt-3 flex items-start gap-2 text-sm text-muted">
              <MessageCircle size={16} aria-hidden className="mt-0.5 flex-none" />
              Texto real de los mensajes. El tercero, el recordatorio de no recogida, es del plan Pro.
            </p>
          </div>
          <div className="flex flex-col items-center gap-5">
            <img src="/landing/ticket.webp" alt="Ticket de una orden en formato de 80 mm: lavandería, número de ticket, cliente, servicios, total, saldo y datos de Yape y Plin." loading="lazy" decoding="async" className="w-full max-w-[330px] rounded-[6px] shadow-pop" />
            <p className="m-0 max-w-[36ch] text-center text-body text-ink-2">El ticket, en térmica de 80 mm o A4, con tus datos de Yape y Plin y tus condiciones al pie.</p>
          </div>
        </div>
      </section>

      {/* Funciones */}
      <section id="funciones" className="scroll-mt-20 px-4 py-20">
        <div className="mx-auto max-w-[1160px]">
          <SectionTitle eyebrow="Funciones" title="Todo lo que usa una lavandería, y nada que no." />
          <ul className="m-0 mt-10 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text, plan }) => (
              <li key={title} className="flex gap-4 rounded-card bg-surface p-5 shadow-card">
                <span className="grid size-11 flex-none place-items-center rounded-tile bg-teal-soft text-teal-ink">
                  <Icon size={21} aria-hidden />
                </span>
                <div>
                  <h3 className="m-0 flex flex-wrap items-center gap-2 text-md font-bold">
                    {title}
                    {plan && <span className="rounded-full bg-pop-soft px-2 py-0.5 text-xs font-bold text-pop-ink">Desde {plan}</span>}
                  </h3>
                  <p className="m-0 mt-1 text-body text-ink-2">{text}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <figure className="m-0">
              <BrowserFrame>
                <Shot name="caja" alt="Caja del día: total cobrado, efectivo, Yape y Plin, efectivo que debe haber en caja y cierre." />
              </BrowserFrame>
              <figcaption className="mt-3 text-body text-ink-2">
                <b className="font-semibold text-ink">Caja del día.</b> Lo cobrado por cada medio de pago y cuánto efectivo debe haber al cerrar.
              </figcaption>
            </figure>
            <figure className="m-0">
              <BrowserFrame>
                <Shot name="reportes" alt="Reportes: órdenes, kilos procesados, facturado, cobrado, órdenes por estado y tiempos de entrega." />
              </BrowserFrame>
              <figcaption className="mt-3 text-body text-ink-2">
                <b className="font-semibold text-ink">Reportes del rubro.</b> Kilos procesados, tiempos de entrega e ingresos por servicio.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Portal del cliente */}
      <section id="portal" className="scroll-mt-20 bg-surface px-4 py-20">
        <div className="mx-auto grid max-w-[1160px] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex justify-center gap-5">
            <PhoneFrame className="w-[230px]">
              <Shot name="portal" alt="Portal del cliente en el celular: saldo por pagar con los datos de Yape y Plin, y el avance de cada orden." />
            </PhoneFrame>
            <PhoneFrame className="mt-12 hidden w-[230px] sm:block">
              <img src="/landing/portal-ingreso.webp" alt="Ingreso al portal con el celular y un código que llega por WhatsApp." loading="lazy" decoding="async" className="block w-full" />
            </PhoneFrame>
          </div>
          <div>
            <SectionTitle eyebrow="Portal del cliente · desde Pro" title="“¿Ya está mi ropa?” se responde solo." text="Cada lavandería tiene su página. El cliente entra con su celular y un código que le llega por WhatsApp, sin crear contraseña." />
            <ul className="m-0 mt-6 flex list-none flex-col gap-3.5 p-0 text-md text-ink-2">
              {[
                'Ve en qué paso está cada orden y cuándo estará lista.',
                'Ve su saldo y dónde pagarlo: tu Yape, tu Plin o tu cuenta.',
                'Pide que pasen a recoger su ropa, si haces domicilio.',
                'Te escribe sus dudas y le respondes desde tu panel.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <Check size={20} aria-hidden className="mt-0.5 flex-none text-teal-ink" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Domicilio */}
      <section className="px-4 py-20">
        <div className="mx-auto grid max-w-[1160px] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <div>
            <SectionTitle eyebrow="Domicilio · desde Pro" title="Recojos y entregas en una sola lista." text="El repartidor entra con su usuario y ve solo lo que tiene asignado: a dónde ir, cuándo, y cuánto cobrar al entregar." />
          </div>
          <BrowserFrame>
            <Shot name="domicilio" alt="Pantalla de domicilio: recojos por hacer y entregas listas para llevar, con dirección, horario, saldo a cobrar y botones para llegar, llamar o escribir." />
          </BrowserFrame>
        </div>
      </section>

      <Pricing />

      {/* Preguntas */}
      <section id="preguntas" className="scroll-mt-20 bg-surface px-4 py-20">
        <div className="mx-auto max-w-[820px]">
          <SectionTitle center eyebrow="Preguntas" title="Antes de empezar" />
          <div className="mt-8 flex flex-col gap-3">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group rounded-card border border-line-strong bg-bg px-5 py-4 open:bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-md font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden className="grid size-7 flex-none place-items-center rounded-full bg-surface-2 text-lg leading-none transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="m-0 mt-3 text-body leading-relaxed text-ink-2">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Cierre */}
      <section className="px-4 py-20">
        <div className="bg-grad mx-auto max-w-[1160px] rounded-panel px-6 py-14 text-center">
          <h2 className="m-0 text-[clamp(28px,4.5vw,44px)] leading-[1.05] font-bold tracking-[-.03em]">Deja el cuaderno esta semana.</h2>
          <p className="mx-auto mt-3.5 mb-0 max-w-[520px] text-lg opacity-90">Crea tu lavandería en dos minutos, carga tus servicios y registra tu primera orden hoy.</p>
          <Link to="/registro" className="mt-7 inline-flex items-center gap-2 rounded-control bg-surface px-6 py-3.5 text-md font-semibold text-ink no-underline hover:brightness-95">
            Probar 30 días gratis <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line px-4 py-8">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4 text-sm text-muted">
          <Logo size="sm" />
          <span>Unify Tec · Hecho en Perú</span>
          <span className="flex flex-wrap gap-5">
            <Link to="/terminos" className="font-semibold text-ink-2 no-underline hover:underline">
              Términos
            </Link>
            <Link to="/privacidad" className="font-semibold text-ink-2 no-underline hover:underline">
              Privacidad
            </Link>
            <Link to="/login" className="font-semibold text-ink-2 no-underline hover:underline">
              Iniciar sesión
            </Link>
            <Link to="/registro" className="font-semibold text-ink-2 no-underline hover:underline">
              Crear cuenta
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
