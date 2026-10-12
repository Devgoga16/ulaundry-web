import { Check, CheckCheck, MapPin, PackageCheck, Receipt, Shirt, Truck, Wallet, WashingMachine } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/display'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { METHOD_LABELS, formatQuantity, formatWhen, type OrderStatus } from '@/features/orders/api'
import { ExpressTag, StatusChip } from '@/features/orders/status-chip'
import { errorMessage } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { formatCents } from '@/lib/format'
import { fullName, personName, usePortalActions, usePortalPayments, type PortalAccount, type PortalOrder, type PortalOrders, type PublicBusiness } from './api'

const STEPS: Array<{ status: OrderStatus; label: string; icon: typeof Shirt }> = [
  { status: 'received', label: 'Recibida', icon: Shirt },
  { status: 'in_process', label: 'En proceso', icon: WashingMachine },
  { status: 'ready', label: 'Lista', icon: PackageCheck },
  { status: 'delivered', label: 'Entregada', icon: CheckCheck },
]

/** Qué está pasando con la orden, en una frase para el cliente. */
function headline(o: PortalOrder): string {
  if (o.pickup?.status === 'pending') return `Pasaremos a recoger tu ropa${o.pickup.window ? ` · ${o.pickup.window}` : ''}`
  if (o.status === 'received') return o.items.length ? `La recibimos. Estará lista ${formatWhen(o.promisedAt).toLowerCase()}` : 'Ya la recogimos. Te confirmamos el monto al pesarla.'
  if (o.status === 'in_process') return `La estamos lavando. Estará lista ${formatWhen(o.promisedAt).toLowerCase()}`
  if (o.status === 'ready') return o.dropoff ? `Ya está lista. Te la llevamos a ${o.dropoff.address}${o.dropoff.window ? ` · ${o.dropoff.window}` : ''}` : `Ya puedes recogerla en ${o.branch.name}`
  if (o.status === 'delivered') return `Entregada ${formatWhen(o.deliveredAt).toLowerCase()}`
  return 'Anulada'
}

function Progress({ status }: { status: OrderStatus }) {
  const index = STEPS.findIndex((s) => s.status === status)
  return (
    <ol className="m-0 grid list-none grid-cols-4 gap-1 p-0" aria-label="Avance de la orden">
      {STEPS.map((step, i) => {
        const done = i < index
        const current = i === index
        const Icon = step.icon
        return (
          <li key={step.status} aria-current={current ? 'step' : undefined} className="flex flex-col items-center gap-1 text-center">
            <span className="flex w-full items-center">
              <span className={cn('h-1 flex-1 rounded-full', i === 0 ? 'opacity-0' : i <= index ? 'bg-teal' : 'bg-line-strong')} />
              <span
                className={cn(
                  'grid size-9 flex-none place-items-center rounded-full border-2',
                  done && 'border-teal bg-teal text-on-teal',
                  current && (status === 'ready' ? 'border-pop bg-pop text-on-pop' : 'border-teal bg-teal-soft text-teal-ink'),
                  !done && !current && 'border-line-strong text-muted',
                )}
              >
                {done ? <Check size={16} aria-hidden /> : <Icon size={16} aria-hidden />}
              </span>
              <span className={cn('h-1 flex-1 rounded-full', i === STEPS.length - 1 ? 'opacity-0' : i < index ? 'bg-teal' : 'bg-line-strong')} />
            </span>
            <span className={cn('text-xs', current ? 'font-bold text-ink' : 'text-muted')}>{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function OrderCard({ order, person, compact }: { order: PortalOrder; person: string; compact?: boolean }) {
  const [open, setOpen] = useState(!compact)
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-xl font-bold">{order.ticket}</span>
            {compact && <StatusChip status={order.status} />}
            {order.express && <ExpressTag />}
          </div>
          <p className="m-0 mt-1 text-md font-semibold">{headline(order)}</p>
          {person && <p className="m-0 text-sm text-muted">Para {person}</p>}
        </div>
        <div className="text-right">
          <div className="text-sm text-muted">{order.balance > 0 ? 'Saldo por pagar' : order.status === 'cancelled' ? '' : order.items.length === 0 ? 'Monto por confirmar' : 'Pagada'}</div>
          {order.status !== 'cancelled' && order.items.length > 0 && <div className={cn('tabular text-xl font-bold', order.balance > 0 ? 'text-pop-ink' : 'text-ok')}>{formatCents(order.balance > 0 ? order.balance : order.total)}</div>}
        </div>
      </div>

      {!compact && <Progress status={order.status} />}

      {order.status === 'ready' && !order.dropoff && (
        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-tile bg-pop-soft px-4 py-3 text-body text-pop-ink">
          <MapPin size={16} aria-hidden className="flex-none" />
          <span>
            <b className="font-bold">{order.branch.name}</b>
            {order.branch.address && ` · ${order.branch.address}`}
          </span>
          {order.branch.mapsUrl && (
            <a href={order.branch.mapsUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
              Cómo llegar
            </a>
          )}
          {!!order.daysReady && order.daysReady > 1 && <span className="basis-full text-sm">Te espera desde hace {order.daysReady} días.</span>}
        </p>
      )}

      {open ? (
        <>
          {order.items.length > 0 && (
            <ul className="m-0 list-none p-0">
              {order.items.map((item, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 border-t border-line py-2 first:border-t-0 first:pt-0">
                  <span>
                    <b className="font-semibold">{formatQuantity(item.quantity, item.unit)}</b> · {item.name}
                    {item.notes && <span className="block text-sm text-muted">{item.notes}</span>}
                  </span>
                  <span className="tabular">{formatCents(item.subtotal)}</span>
                </li>
              ))}
            </ul>
          )}
          {order.observations && (
            <p className="m-0 rounded-tile bg-warn-bg px-3.5 py-2.5 text-sm text-warn">
              <b className="font-semibold">Observaciones: </b>
              {order.observations}
            </p>
          )}
          {order.items.length > 0 && (
            <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-body">
              {order.discount > 0 && (
                <>
                  <dt className="text-muted">Descuento{order.promotionName && ` · ${order.promotionName}`}</dt>
                  <dd className="tabular m-0 text-right">− {formatCents(order.discount)}</dd>
                </>
              )}
              {order.deliveryFee > 0 && (
                <>
                  <dt className="text-muted">Servicio a domicilio</dt>
                  <dd className="tabular m-0 text-right">{formatCents(order.deliveryFee)}</dd>
                </>
              )}
              <dt className="font-bold">Total</dt>
              <dd className="tabular m-0 text-right font-bold">{formatCents(order.total)}</dd>
              <dt className="text-muted">Pagado</dt>
              <dd className="tabular m-0 text-right">{formatCents(order.paid)}</dd>
            </dl>
          )}
          <p className="m-0 text-sm text-muted">
            {order.pickup ? 'Pedida' : 'Dejada'} {formatWhen(order.createdAt).toLowerCase()} · {order.branch.name}
          </p>
        </>
      ) : null}
      {compact && (
        <button type="button" className="cursor-pointer self-start text-sm font-semibold text-brand hover:underline" onClick={() => setOpen((v) => !v)}>
          {open ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
      )}
    </Card>
  )
}

/** Dónde pagar el saldo: los datos que configuró el negocio. */
function HowToPay({ orders, business }: { orders: PortalOrders; business: PublicBusiness }) {
  const pay = orders.paymentInfo
  if (orders.balance <= 0) return null
  const any = pay.yape || pay.plin || pay.bank
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 flex-none place-items-center rounded-tile bg-pop-soft text-pop-ink">
            <Wallet size={20} aria-hidden />
          </span>
          <div>
            <div className="text-sm text-muted">Tu saldo por pagar</div>
            <div className="tabular text-2xl leading-tight font-bold text-pop-ink">{formatCents(orders.balance)}</div>
          </div>
        </div>
      </div>
      {any ? (
        <dl className="m-0 mt-4 grid gap-x-6 gap-y-2 border-t border-line pt-4 text-body sm:grid-cols-[auto_1fr]">
          {pay.yape && (
            <>
              <dt className="font-semibold">Yape</dt>
              <dd className="m-0">{pay.yape}</dd>
            </>
          )}
          {pay.plin && (
            <>
              <dt className="font-semibold">Plin</dt>
              <dd className="m-0">{pay.plin}</dd>
            </>
          )}
          {pay.bank && (
            <>
              <dt className="font-semibold">Transferencia</dt>
              <dd className="m-0">{pay.bank}</dd>
            </>
          )}
        </dl>
      ) : (
        <p className="m-0 mt-3 text-sm text-muted">Puedes pagarlo al recoger tu ropa en {business.name}.</p>
      )}
      {any && <p className="m-0 mt-3 text-sm text-muted">{pay.notes || 'Después de pagar, muestra el comprobante al recoger tu ropa o envíalo al local.'}</p>}
    </Card>
  )
}

/** Pedir que pasen a recoger la ropa. */
function PickupForm({ slug, token, account, business, onDone }: { slug: string; token: string; account: PortalAccount; business: PublicBusiness; onDone: (ticket: string | null) => void }) {
  const { requestPickup } = usePortalActions(slug, token)
  const holder = account.profiles[0]
  const [form, setForm] = useState({
    clientId: holder?.id ?? '',
    branchId: business.branches[0]?.id ?? '',
    address: holder?.address ?? '',
    district: holder?.district ?? '',
    reference: holder?.addressReference ?? '',
    window: '',
    notes: '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.address.trim().length < 4) return setError('Escribe la dirección donde recogemos tu ropa')
    try {
      const result = await requestPickup.mutateAsync({
        clientId: form.clientId || undefined,
        branchId: form.branchId || undefined,
        address: form.address.trim(),
        district: form.district.trim() || undefined,
        reference: form.reference.trim() || undefined,
        window: form.window.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
      onDone(result.ticket)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Card>
      <CardHeader title="Pedir un recojo a domicilio" />
      <p className="mt-0 mb-4 text-sm text-muted">Pasamos por tu ropa, la pesamos en el local y te confirmamos el monto por WhatsApp.</p>
      <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        {error && (
          <p role="alert" className="m-0 rounded-control bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">
            {error}
          </p>
        )}
        <div className="grid gap-3.5 sm:grid-cols-2">
          {account.profiles.length > 1 && (
            <Field label="¿De quién es la ropa?">
              {(p) => (
                <Select {...p} value={form.clientId} onChange={(e) => set({ clientId: e.target.value })}>
                  {account.profiles.map((x) => (
                    <option key={x.id} value={x.id}>
                      {fullName(x)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {business.branches.length > 1 && (
            <Field label="Sucursal">
              {(p) => (
                <Select {...p} value={form.branchId} onChange={(e) => set({ branchId: e.target.value })}>
                  {business.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label="Dirección" className="sm:col-span-2">
            {(p) => <Input {...p} value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Av. Larco 812, dpto. 302" maxLength={200} autoComplete="street-address" />}
          </Field>
          <Field label="Distrito">{(p) => <Input {...p} value={form.district} onChange={(e) => set({ district: e.target.value })} maxLength={60} />}</Field>
          <Field label="¿Cuándo podemos pasar?">{(p) => <Input {...p} value={form.window} onChange={(e) => set({ window: e.target.value })} placeholder="Hoy entre 4 y 6 p. m." maxLength={80} />}</Field>
          <Field label="Referencia" className="sm:col-span-2">
            {(p) => <Input {...p} value={form.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="Portón verde, al lado de la bodega" maxLength={200} />}
          </Field>
          <Field label="Algo que debamos saber (opcional)" className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Son dos bolsas. Tocar el timbre 302." maxLength={300} />}
          </Field>
        </div>
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button onClick={() => onDone(null)} disabled={requestPickup.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={requestPickup.isPending}>
            <Truck size={16} aria-hidden /> {requestPickup.isPending ? 'Enviando…' : 'Pedir recojo'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

/** Inicio: lo que tiene ahora en la lavandería, su saldo y pedir un recojo. */
export function HomeTab({ slug, token, account, orders, business }: { slug: string; token: string; account: PortalAccount; orders: PortalOrders; business: PublicBusiness }) {
  const [params, setParams] = useSearchParams()
  const [asked, setAsked] = useState<string | null>(null)
  const showPerson = account.profiles.length > 1
  const pendingPickup = orders.active.some((o) => o.pickup?.status === 'pending')

  if (params.get('v') === 'recojo' && account.features.homeDelivery) {
    return (
      <PickupForm
        slug={slug}
        token={token}
        account={account}
        business={business}
        onDone={(ticket) => {
          setAsked(ticket)
          setParams({ tab: 'inicio' }, { replace: true })
        }}
      />
    )
  }

  return (
    <>
      {asked && (
        <p role="status" className="m-0 rounded-card bg-ok-bg px-4 py-3 text-body font-semibold text-ok">
          Listo: registramos tu recojo con el ticket {asked}. Te avisaremos cuando pasemos por tu ropa.
        </p>
      )}
      {account.features.homeDelivery && !pendingPickup && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 flex-none place-items-center rounded-tile bg-teal-soft text-teal-ink">
              <Truck size={20} aria-hidden />
            </span>
            <div>
              <div className="font-semibold">¿No puedes venir?</div>
              <div className="text-sm text-muted">Pasamos a recoger tu ropa a tu casa.</div>
            </div>
          </div>
          <Link to="?tab=inicio&v=recojo" className="bg-grad inline-flex items-center gap-1.5 rounded-control px-4 py-2.5 text-sm font-semibold no-underline hover:brightness-110">
            <Truck size={16} aria-hidden /> Pedir recojo
          </Link>
        </Card>
      )}

      <HowToPay orders={orders} business={business} />

      {orders.active.length === 0 ? (
        <Card>
          <EmptyState icon={Shirt} title="No tienes ropa en la lavandería" description={orders.past.length ? 'Tus órdenes anteriores están en Historial.' : `Cuando dejes ropa en ${business.name}, podrás seguirla desde aquí.`} />
        </Card>
      ) : (
        orders.active.map((o) => <OrderCard key={o.id} order={o} person={showPerson ? personName(account.profiles, o.clientId) : ''} />)
      )}
    </>
  )
}

/** Historial: órdenes entregadas o anuladas. */
export function HistoryTab({ account, orders }: { account: PortalAccount; orders: PortalOrders }) {
  const showPerson = account.profiles.length > 1
  if (orders.past.length === 0) {
    return (
      <Card>
        <EmptyState icon={Shirt} title="Aún no tienes órdenes anteriores" description="Aquí quedarán las órdenes que ya recogiste." />
      </Card>
    )
  }
  return (
    <>
      {orders.past.map((o) => (
        <OrderCard key={o.id} order={o} person={showPerson ? personName(account.profiles, o.clientId) : ''} compact />
      ))}
    </>
  )
}

/** Pagos: lo que pagó, por orden y medio de pago. */
export function PaymentsTab({ slug, token, account, orders, business }: { slug: string; token: string; account: PortalAccount; orders: PortalOrders; business: PublicBusiness }) {
  const payments = usePortalPayments(slug, token)
  const showPerson = account.profiles.length > 1
  const items = payments.data?.items ?? []
  const dmy = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`
  return (
    <>
      <HowToPay orders={orders} business={business} />
      <Card>
        <CardHeader title="Tus pagos" actions={payments.data ? <span className="text-sm text-muted">Este año: <b className="font-semibold text-ink">{formatCents(payments.data.totalThisYear)}</b></span> : undefined} />
        {payments.isLoading ? (
          <p className="m-0 py-3 text-sm text-muted">Cargando…</p>
        ) : payments.isError ? (
          <p className="m-0 text-sm font-semibold text-bad">{errorMessage(payments.error)}</p>
        ) : items.length === 0 ? (
          <EmptyState icon={Receipt} title="Aún no registras pagos" description="Cuando pagues una orden aparecerá aquí." />
        ) : (
          <ul className="m-0 list-none p-0">
            {items.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-line py-3 first:border-t-0 first:pt-0">
                <span>
                  <b className="tabular font-semibold">{p.orderTicket}</b> · {METHOD_LABELS[p.method]}
                  {p.reference && ` ${p.reference}`}
                  <span className="block text-sm text-muted">
                    {dmy(p.date)}
                    {showPerson && ` · ${personName(account.profiles, p.clientId)}`}
                  </span>
                </span>
                <span className="tabular text-md font-semibold">{formatCents(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
