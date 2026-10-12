import { Ban, Check, CheckCheck, MapPin, MessageCircle, PackageCheck, Pencil, Printer, Send, Shirt, Truck, Wallet, WashingMachine } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/display'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/overlays'
import { BackLink } from '@/components/ui/page'
import { ProofImage } from '@/components/ui/proof-image'
import { ProofUpload } from '@/components/ui/proof-upload'
import { formatPhone } from '@/features/clients/api'
import { errorMessage, fileUrl } from '@/lib/api/client'
import { useAccess } from '@/lib/auth/access'
import { cn } from '@/lib/cn'
import { formatCents, parseSoles } from '@/lib/format'
import { usePageMeta } from '@/lib/page-meta'
import {
  METHOD_LABELS,
  METHODS,
  UNIT_META,
  formatQuantity,
  formatWhen,
  uploadPaymentProof,
  useOrder,
  useOrderActions,
  type DeliveryLeg,
  type OrderDetail,
  type OrderEvent,
  type OrderStatus,
  type PaymentMethod,
  type PaymentView,
} from './api'
import { ExpressTag, LocationTag, StatusChip } from './status-chip'

type Dialog = null | 'pay' | 'ready' | 'deliver' | 'cancel' | { voidPayment: PaymentView } | { proof: PaymentView }

const FLOW: Array<{ status: OrderStatus; label: string; icon: typeof Shirt }> = [
  { status: 'received', label: 'Recibida', icon: Shirt },
  { status: 'in_process', label: 'En proceso', icon: WashingMachine },
  { status: 'ready', label: 'Lista', icon: PackageCheck },
  { status: 'delivered', label: 'Entregada', icon: CheckCheck },
]

/** Los cuatro pasos de la orden, con el actual resaltado. */
/** Medio de pago dentro de una frase: "en efectivo", pero "en Yape" y "en Plin". */
function methodInText(method: string) {
  const label = METHOD_LABELS[method as PaymentMethod]
  if (!label) return method
  return method === 'yape' || method === 'plin' ? label : label.toLowerCase()
}

function Flow({ order }: { order: OrderDetail }) {
  const index = FLOW.findIndex((f) => f.status === order.status)
  return (
    <ol className="m-0 grid list-none grid-cols-4 gap-1.5 p-0">
      {FLOW.map((step, i) => {
        const done = i < index
        const current = i === index
        const Icon = step.icon
        return (
          <li key={step.status} aria-current={current ? 'step' : undefined} className="flex flex-col items-center gap-1.5 text-center">
            <span className="flex w-full items-center">
              <span className={cn('h-1 flex-1 rounded-full', i === 0 ? 'opacity-0' : i <= index ? 'bg-teal' : 'bg-line-strong')} />
              <span
                className={cn(
                  'grid size-10 flex-none place-items-center rounded-full border-2',
                  done && 'border-teal bg-teal text-on-teal',
                  current && (step.status === 'ready' ? 'border-pop bg-pop text-on-pop' : 'border-teal bg-teal-soft text-teal-ink'),
                  !done && !current && 'border-line-strong text-muted',
                )}
              >
                {done ? <Check size={18} aria-hidden /> : <Icon size={18} aria-hidden />}
              </span>
              <span className={cn('h-1 flex-1 rounded-full', i === FLOW.length - 1 ? 'opacity-0' : i < index ? 'bg-teal' : 'bg-line-strong')} />
            </span>
            <span className={cn('text-sm', current ? 'font-bold text-ink' : 'text-muted')}>{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

const EVENT_LABELS: Record<string, string> = {
  created: 'Orden registrada',
  updated: 'Orden editada',
  'status:received': 'Volvió a recibida',
  'status:in_process': 'Pasó a proceso',
  'status:ready': 'Quedó lista',
  'status:delivered': 'Entregada',
  'status:cancelled': 'Anulada',
  pickup_done: 'Recojo a domicilio realizado',
}

function eventText(e: OrderEvent): { title: string; detail: string } {
  if (e.type === 'payment' || e.type === 'payment_voided') {
    const [head, ...rest] = e.detail.split(' · ')
    const [method, amount] = (head ?? '').split(':')
    const label = `${formatCents(Number(amount) || 0)} en ${methodInText(method)}`
    return { title: e.type === 'payment' ? `Cobro de ${label}` : `Pago anulado: ${label}`, detail: rest.join(' · ') }
  }
  return { title: EVENT_LABELS[e.type] ?? e.type, detail: e.type === 'updated' ? '' : e.detail }
}

function LegCard({ title, leg, action }: { title: string; leg: DeliveryLeg; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-tile border border-line p-3.5">
      <span className={cn('grid size-10 flex-none place-items-center rounded-tile', leg.status === 'done' ? 'bg-ok-bg text-ok' : 'bg-teal-soft text-teal-ink')}>
        {leg.status === 'done' ? <Check size={18} aria-hidden /> : <Truck size={18} aria-hidden />}
      </span>
      <div className="min-w-[180px] flex-1">
        <div className="font-semibold">
          {title} · {leg.status === 'done' ? `${title === 'Recojo' ? 'hecho' : 'hecha'} ${formatWhen(leg.doneAt)}` : 'pendiente'}
        </div>
        <div className="text-sm text-ink-2">
          {leg.address}
          {leg.district && `, ${leg.district}`}
        </div>
        {(leg.window || leg.reference) && <div className="text-sm text-muted">{[leg.window, leg.reference].filter(Boolean).join(' · ')}</div>}
      </div>
      {action}
    </div>
  )
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="m-0 rounded-control bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">
      {message}
    </p>
  )
}

/** Registrar un cobro: monto (por defecto el saldo), medio, operación y comprobante. */
function PayForm({ order, onDone, thenDeliver }: { order: OrderDetail; onDone: () => void; thenDeliver?: boolean }) {
  const { pay, deliver } = useOrderActions()
  const [amount, setAmount] = useState((order.balance / 100).toFixed(2))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [proofKey, setProofKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cents = parseSoles(amount)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (cents === null || cents <= 0) return setError('Ingresa un monto válido')
    if (cents > order.balance) return setError(`El saldo es ${formatCents(order.balance)}`)
    try {
      await pay.mutateAsync({ id: order.id, amount: cents, method, ...(reference.trim() && { reference: reference.trim() }), ...(proofKey && { proofKey }) })
      if (thenDeliver) await deliver.mutateAsync({ id: order.id, allowBalance: cents < order.balance })
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  const busy = pay.isPending || deliver.isPending

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
      <ErrorNote message={error} />
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Monto" hint={`Saldo: ${formatCents(order.balance)}`}>
          {(p) => (
            <div className="flex">
              <span className="grid place-items-center rounded-l-control border border-r-0 border-line-strong bg-surface-2 px-3 text-body text-muted">S/</span>
              <Input {...p} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" autoFocus className="rounded-l-none text-md font-semibold" />
            </div>
          )}
        </Field>
        <Field label="Medio de pago">
          {(p) => (
            <Select {...p} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {method !== 'cash' && (
        <>
          <Field label="N.º de operación (opcional)">{(p) => <Input {...p} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} />}</Field>
          <ProofUpload upload={uploadPaymentProof} onChange={setProofKey} label="Foto del comprobante (opcional)" />
        </>
      )}
      <div className="flex justify-end gap-2.5">
        <Button onClick={onDone} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : thenDeliver ? 'Cobrar y entregar' : 'Registrar cobro'}
        </Button>
      </div>
    </form>
  )
}

function ReasonForm({ label, placeholder, confirm, danger, onSubmit, onCancel }: { label: string; placeholder: string; confirm: string; danger?: boolean; onSubmit: (reason: string) => Promise<unknown>; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <form
      noValidate
      className="flex flex-col gap-3.5"
      onSubmit={async (e) => {
        e.preventDefault()
        if (reason.trim().length < 3) return setError('Escribe el motivo')
        setBusy(true)
        setError(null)
        try {
          await onSubmit(reason.trim())
        } catch (err) {
          setError(errorMessage(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <ErrorNote message={error} />
      <Field label={label}>{(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} maxLength={300} autoFocus />}</Field>
      <div className="flex justify-end gap-2.5">
        <Button onClick={onCancel} disabled={busy}>
          Volver
        </Button>
        <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={busy}>
          {busy ? 'Guardando…' : confirm}
        </Button>
      </div>
    </form>
  )
}

/** Marcar lista: pide dónde queda guardada para encontrarla rápido. */
function ReadyForm({ order, onDone }: { order: OrderDetail; onDone: () => void }) {
  const { status } = useOrderActions()
  const [location, setLocation] = useState(order.location)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      noValidate
      className="flex flex-col gap-3.5"
      onSubmit={async (e) => {
        e.preventDefault()
        setError(null)
        try {
          await status.mutateAsync({ id: order.id, status: 'ready', location: location.trim() })
          onDone()
        } catch (err) {
          setError(errorMessage(err))
        }
      }}
    >
      <ErrorNote message={error} />
      <Field label="Ubicación" hint="Estante o casillero donde la dejas. Ej.: B-12. Podrás buscarla por este código.">
        {(p) => <Input {...p} value={location} onChange={(e) => setLocation(e.target.value.toUpperCase())} placeholder="B-12" maxLength={40} autoFocus className="text-md font-semibold" />}
      </Field>
      <p className="m-0 text-sm text-muted">
        {order.status === 'ready' ? 'Solo se actualiza la ubicación.' : order.clientPhone ? `Le avisaremos a ${order.clientName.split(' ')[0]} por WhatsApp que ya puede recogerla.` : 'El cliente no tiene celular: no recibirá aviso.'}
      </p>
      <div className="flex justify-end gap-2.5">
        <Button onClick={onDone} disabled={status.isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={status.isPending}>
          {status.isPending ? 'Guardando…' : order.status === 'ready' ? 'Guardar ubicación' : 'Marcar como lista'}
        </Button>
      </div>
    </form>
  )
}

/** Ficha de la orden: estado, qué trae, saldo, pagos e historial, con la siguiente acción a la mano. */
export function OrderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { can, hasFeature, readOnly } = useAccess()
  const query = useOrder(id)
  const { status, deliver, cancel, voidPayment, notify, completeLeg } = useOrderActions()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(params.get('nueva') ? 'Orden registrada.' : null)
  const [deliverMode, setDeliverMode] = useState<'choose' | 'pay'>('choose')

  const o = query.data
  usePageMeta(o ? { title: `Orden ${o.ticket}`, crumb: `Órdenes / ${o.ticket}` } : null)

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[220px] rounded-card" />
        <Skeleton className="h-[320px] rounded-card" />
      </div>
    )
  }
  if (!o) {
    return (
      <Card>
        <EmptyState
          icon={Shirt}
          title="No encontramos esta orden"
          action={
            <Link to="/ordenes" className="text-sm font-semibold text-brand hover:underline">
              Volver a Órdenes
            </Link>
          }
        />
      </Card>
    )
  }

  const open = o.status !== 'delivered' && o.status !== 'cancelled'
  const write = !readOnly
  const canProcess = can('order.process') && write && open
  const canDeliver = can('order.deliver') && write
  const canPay = can('payment.create') && write && o.status !== 'cancelled' && o.balance > 0
  const digits = o.clientPhone.replace(/\D/g, '')
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(null)
    setNotice(null)
    try {
      await fn()
      if (ok) setNotice(ok)
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  const close = () => {
    setDialog(null)
    setDeliverMode('choose')
  }

  return (
    <>
      <BackLink to="/ordenes" label="Órdenes" />

      <Card className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="tabular m-0 text-3xl leading-none font-bold tracking-[-.02em]">{o.ticket}</h2>
              <StatusChip status={o.status} />
              {o.express && <ExpressTag />}
            </div>
            <div className="mt-2.5 text-md">
              {can('client.read') ? (
                <Link to={`/clientes/${o.clientId}`} className="font-semibold text-ink hover:underline">
                  {o.clientName}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{o.clientName}</span>
              )}
              <span className="text-muted"> · {formatPhone(o.clientPhone) || 'Sin celular'}</span>
            </div>
            <div className="mt-1 text-sm text-muted">Recibida {formatWhen(o.createdAt)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-muted">{o.balance > 0 ? 'Saldo por cobrar' : o.status === 'cancelled' ? 'Total' : 'Pagada'}</div>
            <div className={cn('tabular text-3xl leading-tight font-bold', o.balance > 0 ? 'text-pop-ink' : 'text-ok')}>{formatCents(o.balance > 0 ? o.balance : o.total)}</div>
            {o.balance > 0 && <div className="text-sm text-muted">de {formatCents(o.total)}</div>}
          </div>
        </div>

        {o.status === 'cancelled' ? (
          <p className="m-0 rounded-tile bg-off-bg px-4 py-3 text-sm text-off">
            <b className="font-semibold">Anulada {formatWhen(o.cancelledAt)}</b>
            {o.cancelReason && ` · ${o.cancelReason}`}
          </p>
        ) : (
          <Flow order={o} />
        )}

        {open && (
          <div className="grid gap-3 rounded-tile bg-surface-2 p-4 sm:grid-cols-3">
            <div>
              <div className="text-sm font-semibold text-muted">{o.status === 'ready' ? 'Lista desde' : 'Prometida para'}</div>
              <div className={cn('text-md font-semibold', o.overdue && 'text-bad')}>
                {o.status === 'ready' ? formatWhen(o.readyAt) : formatWhen(o.promisedAt)}
                {o.overdue && ' · atrasada'}
              </div>
              {o.status === 'ready' && !!o.daysReady && (
                <div className={cn('text-sm font-semibold', o.unclaimed ? 'text-bad' : 'text-pop-ink')}>
                  {o.daysReady} {o.daysReady === 1 ? 'día' : 'días'} sin recoger{o.unclaimed && ' · no recogida'}
                </div>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-muted">Ubicación</div>
              <div className="mt-0.5 flex items-center gap-2">
                <LocationTag location={o.location} />
                {o.status === 'ready' && canProcess && (
                  <button type="button" className="cursor-pointer text-sm font-semibold text-brand hover:underline" onClick={() => setDialog('ready')}>
                    Cambiar
                  </button>
                )}
              </div>
            </div>
            {o.status === 'ready' && o.remindersSent > 0 && (
              <div>
                <div className="text-sm font-semibold text-muted">Recordatorios</div>
                <div className="text-md font-semibold">{o.remindersSent} enviados</div>
              </div>
            )}
          </div>
        )}

        {error && <ErrorNote message={error} />}
        {notice && (
          <p role="status" className="m-0 rounded-control bg-ok-bg px-3 py-2 text-sm font-semibold text-ok">
            {notice}
          </p>
        )}

        <div className="flex flex-wrap gap-2.5">
          {o.status === 'received' && canProcess && o.items.length > 0 && (
            <Button variant="primary" disabled={status.isPending} onClick={() => void run(() => status.mutateAsync({ id: o.id, status: 'in_process' }))}>
              <WashingMachine size={16} aria-hidden /> Pasar a proceso
            </Button>
          )}
          {o.status === 'received' && can('order.update') && write && o.items.length === 0 && (
            <Button variant="primary" onClick={() => navigate(`/ordenes/${o.id}/editar`)}>
              <Pencil size={16} aria-hidden /> Pesar y completar la orden
            </Button>
          )}
          {o.status === 'in_process' && canProcess && (
            <Button variant="primary" onClick={() => setDialog('ready')}>
              <PackageCheck size={16} aria-hidden /> Marcar como lista
            </Button>
          )}
          {o.status === 'ready' && canDeliver && (
            <Button variant="primary" disabled={deliver.isPending} onClick={() => (o.balance > 0 ? setDialog('deliver') : void run(() => deliver.mutateAsync({ id: o.id }), 'Orden entregada.'))}>
              <CheckCheck size={16} aria-hidden /> Entregar al cliente
            </Button>
          )}
          {canPay && (
            <Button onClick={() => setDialog('pay')}>
              <Wallet size={16} aria-hidden /> Cobrar
            </Button>
          )}
          {hasFeature('printable_ticket') && (
            <Button onClick={() => window.open(`/ordenes/${o.id}/ticket`, '_blank', 'noopener')}>
              <Printer size={16} aria-hidden /> Imprimir ticket
            </Button>
          )}
          {open && can('order.update') && write && o.items.length > 0 && (
            <Button onClick={() => navigate(`/ordenes/${o.id}/editar`)}>
              <Pencil size={16} aria-hidden /> Editar
            </Button>
          )}
          {hasFeature('whatsapp') && write && o.clientPhone && open && (
            <Button
              disabled={notify.isPending}
              onClick={() => void run(() => notify.mutateAsync({ id: o.id, kind: o.status === 'ready' ? 'ready' : 'received' }), 'Aviso enviado por WhatsApp.')}
              title={o.status === 'ready' ? 'Reenvía el aviso de que ya está lista' : 'Reenvía el aviso de orden recibida'}
            >
              <Send size={16} aria-hidden /> Reenviar aviso
            </Button>
          )}
          {digits.length >= 9 && (
            <a
              href={`https://wa.me/51${digits.slice(-9)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink-2 hover:border-teal"
            >
              <MessageCircle size={16} aria-hidden /> WhatsApp
            </a>
          )}
          {o.status === 'in_process' && canProcess && (
            <Button variant="ghost" disabled={status.isPending} onClick={() => void run(() => status.mutateAsync({ id: o.id, status: 'received' }))}>
              Volver a recibida
            </Button>
          )}
          {o.status === 'ready' && canProcess && (
            <Button variant="ghost" disabled={status.isPending} onClick={() => void run(() => status.mutateAsync({ id: o.id, status: 'in_process' }))}>
              Volver a proceso
            </Button>
          )}
          {open && can('order.cancel') && write && (
            <Button variant="danger" className="ml-auto" onClick={() => setDialog('cancel')}>
              <Ban size={16} aria-hidden /> Anular
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Qué dejó" />
            {o.items.length === 0 ? (
              <p className="m-0 rounded-tile bg-warn-bg px-4 py-3 text-sm text-warn">Aún no se pesa la ropa. Al llegar, completa los servicios desde "Pesar y completar la orden".</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {o.items.map((item, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 border-t border-line py-3 first:border-t-0 first:pt-0">
                    <span className="tabular w-[110px] text-md font-bold">{formatQuantity(item.quantity, item.unit)}</span>
                    <span className="min-w-[160px] flex-1">
                      <span className="block font-semibold">{item.name}</span>
                      {item.notes && <span className="block text-sm text-muted">{item.notes}</span>}
                      <span className="block text-sm text-muted">
                        {formatCents(item.unitPrice)} por {UNIT_META[item.unit].per}
                      </span>
                    </span>
                    <span className="tabular text-md font-semibold">{formatCents(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
            )}
            {(o.observations || o.photos.length > 0) && (
              <div className="mt-4 rounded-tile bg-warn-bg p-4">
                <div className="text-sm font-bold text-warn">Observaciones</div>
                {o.observations && <p className="m-0 mt-1 text-body whitespace-pre-line text-warn">{o.observations}</p>}
                {o.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {o.photos.map((photo) => (
                      <a key={photo.key} href={fileUrl(photo.url)} target="_blank" rel="noreferrer" className="block size-24 overflow-hidden rounded-tile border border-line bg-surface">
                        <img src={fileUrl(photo.url)} alt="Foto de la observación" className="size-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {(o.pickup || o.dropoff) && (
            <Card>
              <CardHeader title="A domicilio" />
              <div className="flex flex-col gap-3">
                {o.pickup && (
                  <LegCard
                    title="Recojo"
                    leg={o.pickup}
                    action={
                      o.pickup.status === 'pending' && canDeliver && open ? (
                        <Button size="sm" disabled={completeLeg.isPending} onClick={() => void run(() => completeLeg.mutateAsync({ id: o.id, leg: 'pickup' }), 'Recojo marcado como realizado.')}>
                          <Check size={14} aria-hidden /> Ya se recogió
                        </Button>
                      ) : undefined
                    }
                  />
                )}
                {o.dropoff && <LegCard title="Entrega" leg={o.dropoff} />}
                <p className="m-0 flex items-center gap-1.5 text-sm text-muted">
                  <MapPin size={14} aria-hidden /> Repartidor: <b className="font-semibold text-ink-2">{o.courierName ?? 'sin asignar'}</b>
                </p>
              </div>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Cuenta" />
            <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-body">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular m-0 text-right">{formatCents(o.subtotal)}</dd>
              {o.discount > 0 && (
                <>
                  <dt className="text-muted">Descuento{o.promotionName && ` · ${o.promotionName}`}</dt>
                  <dd className="tabular m-0 text-right">− {formatCents(o.discount)}</dd>
                </>
              )}
              {o.deliveryFee > 0 && (
                <>
                  <dt className="text-muted">Servicio a domicilio</dt>
                  <dd className="tabular m-0 text-right">{formatCents(o.deliveryFee)}</dd>
                </>
              )}
              <dt className="mt-1 border-t border-line pt-2 font-bold">Total</dt>
              <dd className="tabular m-0 mt-1 border-t border-line pt-2 text-right font-bold">{formatCents(o.total)}</dd>
              <dt className="text-muted">Cobrado</dt>
              <dd className="tabular m-0 text-right">{formatCents(o.paid)}</dd>
              <dt className={cn('text-md font-bold', o.balance > 0 ? 'text-pop-ink' : 'text-ok')}>Saldo</dt>
              <dd className={cn('tabular m-0 text-right text-md font-bold', o.balance > 0 ? 'text-pop-ink' : 'text-ok')}>{formatCents(o.balance)}</dd>
            </dl>

            <h4 className="m-0 mt-5 mb-1 text-sm font-bold tracking-[.06em] text-muted uppercase">Pagos</h4>
            {o.payments.length === 0 ? (
              <p className="m-0 text-sm text-muted">Aún no se registra ningún cobro.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {o.payments.map((p) => (
                  <li key={p.id} className={cn('border-t border-line py-2.5 first:border-t-0', p.status === 'voided' && 'opacity-60')}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={cn('tabular font-semibold', p.status === 'voided' && 'line-through')}>{formatCents(p.amount)}</span>
                      <span className="text-sm text-ink-2">
                        {METHOD_LABELS[p.method]}
                        {p.reference && ` · ${p.reference}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                      <span>
                        {formatWhen(p.createdAt)} · {p.receivedByName}
                      </span>
                      {p.status === 'voided' && <span className="font-semibold text-bad">Anulado: {p.voidReason}</span>}
                      {p.hasProof && (
                        <button type="button" className="cursor-pointer font-semibold text-brand hover:underline" onClick={() => setDialog({ proof: p })}>
                          Ver comprobante
                        </button>
                      )}
                      {p.status === 'valid' && can('payment.void') && write && (
                        <button type="button" className="cursor-pointer font-semibold text-bad hover:underline" onClick={() => setDialog({ voidPayment: p })}>
                          Anular
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Historial" />
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {[...o.history].reverse().map((e, i) => {
                const text = eventText(e)
                return (
                  <li key={i} className="grid grid-cols-[10px_minmax(0,1fr)] gap-3">
                    <span aria-hidden className="mt-1.5 size-2.5 rounded-full bg-teal" />
                    <span>
                      <span className="block font-semibold">{text.title}</span>
                      {text.detail && <span className="block text-sm text-ink-2">{text.detail}</span>}
                      <span className="block text-xs text-muted">
                        {formatWhen(e.at)}
                        {e.byName && ` · ${e.byName}`}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </Card>
        </div>
      </div>

      <Modal open={dialog === 'pay'} onOpenChange={(v) => !v && close()} title={`Cobrar ${o.ticket}`}>
        {dialog === 'pay' && <PayForm order={o} onDone={close} />}
      </Modal>

      <Modal open={dialog === 'ready'} onOpenChange={(v) => !v && close()} title={o.status === 'ready' ? 'Cambiar ubicación' : `${o.ticket} está lista`}>
        {dialog === 'ready' && <ReadyForm order={o} onDone={close} />}
      </Modal>

      <Modal open={dialog === 'deliver'} onOpenChange={(v) => !v && close()} title={`Entregar ${o.ticket}`}>
        {dialog === 'deliver' &&
          (deliverMode === 'pay' ? (
            <PayForm order={o} onDone={close} thenDeliver />
          ) : (
            <div className="flex flex-col gap-4">
              <p className="m-0 rounded-tile bg-pop-soft px-4 py-3 text-body text-pop-ink">
                Esta orden tiene un saldo de <b className="font-bold">{formatCents(o.balance)}</b>. ¿Lo cobras ahora?
              </p>
              <ErrorNote message={error} />
              <div className="flex flex-wrap justify-end gap-2.5">
                <Button onClick={close}>Cancelar</Button>
                <Button
                  disabled={deliver.isPending}
                  onClick={() =>
                    void run(async () => {
                      await deliver.mutateAsync({ id: o.id, allowBalance: true })
                      close()
                    }, 'Orden entregada con saldo pendiente.')
                  }
                >
                  Entregar con saldo
                </Button>
                {canPay && (
                  <Button variant="primary" onClick={() => setDeliverMode('pay')}>
                    <Wallet size={16} aria-hidden /> Cobrar y entregar
                  </Button>
                )}
              </div>
            </div>
          ))}
      </Modal>

      <Modal open={dialog === 'cancel'} onOpenChange={(v) => !v && close()} title={`Anular ${o.ticket}`}>
        {dialog === 'cancel' && (
          <ReasonForm
            label="Motivo"
            placeholder="El cliente se arrepintió, se registró por error…"
            confirm="Anular orden"
            danger
            onCancel={close}
            onSubmit={async (reason) => {
              await cancel.mutateAsync({ id: o.id, reason })
              close()
            }}
          />
        )}
      </Modal>

      <Modal open={!!dialog && typeof dialog === 'object' && 'voidPayment' in dialog} onOpenChange={(v) => !v && close()} title="Anular pago">
        {dialog && typeof dialog === 'object' && 'voidPayment' in dialog && (
          <>
            <p className="m-0 mb-3 text-body text-ink-2">
              Se anula el cobro de <b className="font-semibold">{formatCents(dialog.voidPayment.amount)}</b> en {methodInText(dialog.voidPayment.method)} y el monto vuelve al saldo de la orden.
            </p>
            <ReasonForm
              label="Motivo"
              placeholder="Se digitó dos veces, devolución al cliente…"
              confirm="Anular pago"
              danger
              onCancel={close}
              onSubmit={async (reason) => {
                await voidPayment.mutateAsync({ id: dialog.voidPayment.id, reason })
                close()
              }}
            />
          </>
        )}
      </Modal>

      <Modal open={!!dialog && typeof dialog === 'object' && 'proof' in dialog} onOpenChange={(v) => !v && close()} title="Comprobante">
        {dialog && typeof dialog === 'object' && 'proof' in dialog && <ProofImage path={`/payments/${dialog.proof.id}/proof`} />}
      </Modal>
    </>
  )
}
