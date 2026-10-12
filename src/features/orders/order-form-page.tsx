import { useQuery } from '@tanstack/react-query'
import { ImagePlus, Loader2, Plus, Shirt, Trash2, X, Zap } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/controls'
import { EmptyState, Skeleton } from '@/components/ui/display'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { BackLink, FormActions, FormSection } from '@/components/ui/page'
import { ProofUpload } from '@/components/ui/proof-upload'
import { formatPhone, useClient } from '@/features/clients/api'
import { ClientPicker } from '@/features/clients/client-picker'
import { promotionValue, usePromotions } from '@/features/promotions/api'
import { useOrderSettings } from '@/features/settings/api'
import { api, ApiError, errorMessage, fileUrl } from '@/lib/api/client'
import type { Client } from '@/lib/api/types'
import { useAccess } from '@/lib/auth/access'
import { useBranch } from '@/lib/auth/branch-context'
import { cn } from '@/lib/cn'
import { formatCents, parseSoles } from '@/lib/format'
import { usePageMeta } from '@/lib/page-meta'
import { isoToZoned, zonedToIso } from '@/lib/time'
import {
  METHOD_LABELS,
  METHODS,
  UNIT_META,
  formatWhen,
  uploadOrderPhoto,
  uploadPaymentProof,
  useOrder,
  useOrderActions,
  useServices,
  type LegInput,
  type OrderDetail,
  type PaymentMethod,
  type Service,
} from './api'

const HOUR = 3_600_000
const MAX_PHOTOS = 8

interface Line {
  key: number
  serviceId: string
  quantity: string
  notes: string
}
interface LegForm {
  on: boolean
  address: string
  district: string
  reference: string
  window: string
}

let lineKey = 0
const newLine = (serviceId = '', quantity = '', notes = ''): Line => ({ key: ++lineKey, serviceId, quantity, notes })
const legFrom = (leg: { address: string; district: string; reference: string; window: string } | null | undefined): LegForm =>
  leg ? { on: true, address: leg.address, district: leg.district, reference: leg.reference, window: leg.window } : { on: false, address: '', district: '', reference: '', window: '' }
const toNumber = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')))

/** Subtotal de una línea con el precio vigente del catálogo (lo definitivo lo calcula la API). */
function lineSubtotal(line: Line, service: Service | undefined, express: boolean): number | null {
  const q = toNumber(line.quantity)
  if (!service || !Number.isFinite(q) || q <= 0) return null
  const price = express ? service.expressPrice : service.price
  if (price === null) return null
  return Math.round(Math.max(q, service.minQuantity ?? 0) * price)
}

function LegFields({ title, hint, leg, onChange, error }: { title: string; hint: string; leg: LegForm; onChange: (patch: Partial<LegForm>) => void; error?: string }) {
  return (
    <div className="rounded-tile border border-line p-4">
      <label className="flex cursor-pointer items-center gap-2.5">
        <Switch checked={leg.on} onCheckedChange={(v) => onChange({ on: v })} />
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm text-muted">{hint}</span>
        </span>
      </label>
      {leg.on && (
        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
          <Field label="Dirección" error={error} className="sm:col-span-2">
            {(p) => <Input {...p} value={leg.address} onChange={(e) => onChange({ address: e.target.value })} placeholder="Av. Larco 812, dpto. 302" maxLength={200} />}
          </Field>
          <Field label="Distrito">{(p) => <Input {...p} value={leg.district} onChange={(e) => onChange({ district: e.target.value })} maxLength={60} />}</Field>
          <Field label="Cuándo pasar">{(p) => <Input {...p} value={leg.window} onChange={(e) => onChange({ window: e.target.value })} placeholder="Hoy 4–6 p. m." maxLength={80} />}</Field>
          <Field label="Referencia" className="sm:col-span-2">
            {(p) => <Input {...p} value={leg.reference} onChange={(e) => onChange({ reference: e.target.value })} placeholder="Portón verde, al lado de la bodega" maxLength={200} />}
          </Field>
        </div>
      )}
    </div>
  )
}

function OrderForm({ order, initialClient }: { order: OrderDetail | null; initialClient: Client | null }) {
  const navigate = useNavigate()
  const { hasFeature, can } = useAccess()
  const { current, branches } = useBranch()
  const services = useServices()
  const settings = useOrderSettings()
  const { create, update } = useOrderActions()
  const canDeliver = hasFeature('home_delivery')
  const canPhotos = hasFeature('order_photos')
  const promotions = usePromotions(true, hasFeature('promotions'))
  const couriers = useQuery({
    queryKey: ['orders', 'couriers'],
    queryFn: () => api<Array<{ membershipId: string; name: string; roles: string }>>('/orders/couriers'),
    enabled: canDeliver && can('delivery.manage'),
  })

  const [client, setClient] = useState<Client | null>(initialClient)
  const [lines, setLines] = useState<Line[]>(() => (order?.items.length ? order.items.map((i) => newLine(i.serviceId, String(i.quantity), i.notes)) : [newLine()]))
  const [express, setExpress] = useState(order?.express ?? false)
  const [observations, setObservations] = useState(order?.observations ?? '')
  const [photos, setPhotos] = useState<Array<{ key: string; url: string }>>(order?.photos ?? [])
  const [uploading, setUploading] = useState(false)
  const [discount, setDiscount] = useState(order?.discount && !order.promotionId ? (order.discount / 100).toFixed(2) : '')
  const [promotionId, setPromotionId] = useState(order?.promotionId ?? '')
  const promised0 = order ? isoToZoned(order.promisedAt) : null
  const [promised, setPromised] = useState<{ date: string; time: string } | null>(promised0)
  const [pickup, setPickup] = useState<LegForm>(legFrom(order?.pickup))
  const [dropoff, setDropoff] = useState<LegForm>(legFrom(order?.dropoff))
  const [deliveryFee, setDeliveryFee] = useState(order?.deliveryFee ? (order.deliveryFee / 100).toFixed(2) : '')
  const [courier, setCourier] = useState(order?.courierMembershipId ?? '')
  const [advance, setAdvance] = useState({ amount: '', method: 'cash' as PaymentMethod, reference: '', proofKey: null as string | null })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const catalog = services.data ?? []
  const byId = new Map(catalog.map((s) => [s.id, s]))
  const branch = order ? branches.find((b) => b.id === order.branchId) : current
  const pickupPending = pickup.on && order?.pickup?.status !== 'done'
  const filled = lines.filter((l) => l.serviceId)
  const subtotal = filled.reduce((sum, l) => sum + (lineSubtotal(l, byId.get(l.serviceId), express) ?? 0), 0)
  // Estimado de la promoción con las mismas reglas de la API (la API tiene la última palabra).
  const promotion = promotions.data?.find((x) => x.id === promotionId)
  const promoBase = promotion ? filled.filter((l) => promotion.serviceIds.length === 0 || promotion.serviceIds.includes(l.serviceId)).reduce((sum, l) => sum + (lineSubtotal(l, byId.get(l.serviceId), express) ?? 0), 0) : 0
  const promoDiscount = promotion ? Math.min(promotion.type === 'percent' ? Math.round((promoBase * promotion.value) / 100) : promotion.value, promoBase) : 0
  const discountCents = promotionId ? promoDiscount : discount.trim() === '' ? 0 : (parseSoles(discount) ?? 0)
  const feeCents = (pickup.on || dropoff.on) && deliveryFee.trim() !== '' ? (parseSoles(deliveryFee) ?? 0) : 0
  const total = Math.max(subtotal - discountCents, 0) + feeCents
  const advanceCents = advance.amount.trim() === '' ? 0 : (parseSoles(advance.amount) ?? 0)
  const paid = order ? order.paid : advanceCents
  const minAdvance = settings.data && !order && filled.length ? Math.ceil((total * settings.data.minAdvancePercent) / 100) : 0
  const autoPromised = settings.data ? new Date(Date.now() + (express ? settings.data.expressHours : settings.data.normalHours) * HOUR).toISOString() : null

  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const setLeg = (which: 'pickup' | 'dropoff') => (patch: Partial<LegForm>) => {
    const apply = which === 'pickup' ? setPickup : setDropoff
    apply((leg) => {
      const next = { ...leg, ...patch }
      // Al activarlo, se propone la dirección registrada del cliente.
      if (patch.on && !leg.address && client) return { ...next, address: client.address ?? '', district: client.district ?? '', reference: client.addressReference ?? '' }
      return next
    })
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    setUploading(true)
    try {
      for (const file of [...files].slice(0, MAX_PHOTOS - photos.length)) {
        const photo = await uploadOrderPhoto(file)
        setPhotos((p) => [...p, photo])
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const legInput = (leg: LegForm): LegInput => ({ address: leg.address.trim(), district: leg.district.trim(), reference: leg.reference.trim(), window: leg.window.trim() })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const next: Record<string, string> = {}
    // Al editar, el cliente y la sucursal ya son de la orden.
    if (!order && !client) next.client = 'Elige o registra al cliente'
    if (!order && !branch) next.branch = 'Elige una sucursal'
    if (filled.length === 0 && !pickupPending) next.lines = 'Agrega al menos un servicio'
    for (const l of filled) {
      const service = byId.get(l.serviceId)
      const q = toNumber(l.quantity)
      if (!Number.isFinite(q) || q <= 0) next[`q${l.key}`] = 'Ingresa la cantidad'
      else if (service && service.unit !== 'kg' && !Number.isInteger(q)) next[`q${l.key}`] = 'Usa un número entero'
      if (service && express && service.expressPrice === null) next[`s${l.key}`] = 'Este servicio no se ofrece en express'
    }
    if (!promotionId && discount.trim() !== '' && parseSoles(discount) === null) next.discount = 'Monto inválido'
    else if (!promotionId && discountCents > subtotal) next.discount = 'No puede ser mayor que el subtotal'
    if (pickup.on && pickup.address.trim().length < 4) next.pickup = 'Escribe la dirección de recojo'
    if (dropoff.on && dropoff.address.trim().length < 4) next.dropoff = 'Escribe la dirección de entrega'
    if ((pickup.on || dropoff.on) && deliveryFee.trim() !== '' && parseSoles(deliveryFee) === null) next.deliveryFee = 'Monto inválido'
    if (!order) {
      if (advance.amount.trim() !== '' && parseSoles(advance.amount) === null) next.advance = 'Monto inválido'
      else if (advanceCents > total) next.advance = 'No puede ser mayor que el total'
      else if (advanceCents < minAdvance) next.advance = `El adelanto mínimo es ${formatCents(minAdvance)}`
    } else if (total < order.paid) next.lines = `El total no puede ser menor que lo ya cobrado (${formatCents(order.paid)})`
    setErrors(next)
    if (Object.keys(next).length) {
      setError('Revisa los campos marcados.')
      return
    }

    const body = {
      items: filled.map((l) => ({ serviceId: l.serviceId, quantity: toNumber(l.quantity), ...(l.notes.trim() && { notes: l.notes.trim() }) })),
      express,
      observations: observations.trim(),
      ...(canPhotos && { photos: photos.map((p) => p.key) }),
      ...(promotionId ? { promotionId } : { discount: discountCents, ...(order?.promotionId && { promotionId: null }) }),
      ...(promised && { promisedAt: zonedToIso(promised.date, promised.time) }),
      ...(canDeliver && { deliveryFee: feeCents }),
    }
    try {
      if (order) {
        const saved = await update.mutateAsync({
          id: order.id,
          ...body,
          // Sin líneas (recojo aún sin pesar) no se envían: la API exige al menos una al editar.
          items: body.items.length ? body.items : undefined,
          ...(canDeliver && { pickup: pickup.on ? legInput(pickup) : null, dropoff: dropoff.on ? legInput(dropoff) : null, courierMembershipId: courier || null }),
        })
        navigate(`/ordenes/${saved.id}`)
      } else {
        const saved = await create.mutateAsync({
          branchId: branch!.id,
          clientId: client!.id,
          ...body,
          ...(pickup.on && { pickup: legInput(pickup) }),
          ...(dropoff.on && { dropoff: legInput(dropoff) }),
          ...(courier && { courierMembershipId: courier }),
          ...(advanceCents > 0 && {
            advance: { amount: advanceCents, method: advance.method, ...(advance.reference.trim() && { reference: advance.reference.trim() }), ...(advance.proofKey && { proofKey: advance.proofKey }) },
          }),
        })
        navigate(`/ordenes/${saved.id}?nueva=1`, { replace: true })
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PLAN_LIMIT_REACHED') setError('Llegaste al tope de órdenes de este mes en tu plan. Sube de plan en Configuración para seguir registrando.')
      else setError(errorMessage(err))
    }
  }

  const busy = create.isPending || update.isPending
  const back = order ? `/ordenes/${order.id}` : '/ordenes'

  if (!services.isLoading && catalog.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Shirt}
          title="Primero crea tus servicios"
          description="Para registrar una orden necesitas al menos un servicio con su precio."
          action={
            <Link to="/servicios/nuevo" className="text-sm font-semibold text-brand hover:underline">
              Crear un servicio
            </Link>
          }
        />
      </Card>
    )
  }

  return (
    <Card>
      <form noValidate onSubmit={submit} className="flex flex-col">
        {error && (
          <div role="alert" className="mb-4 rounded-control bg-bad-bg px-3 py-2.5 text-sm font-semibold text-bad">
            {error}
          </div>
        )}
        <fieldset disabled={busy} className="m-0 flex min-w-0 flex-col border-0 p-0">
          <FormSection title="Cliente" description={order ? 'El cliente de una orden no se cambia.' : 'Búscalo por nombre o celular, o regístralo aquí mismo.'}>
            {order ? (
              <div>
                <div className="text-md font-semibold">{order.clientName}</div>
                <div className="text-sm text-muted">{formatPhone(order.clientPhone) || 'Sin celular'}</div>
              </div>
            ) : (
              <>
                <ClientPicker value={client} onChange={setClient} />
                {errors.client && <p className="m-0 text-2xs font-semibold text-bad">{errors.client}</p>}
                {errors.branch && <p className="m-0 text-2xs font-semibold text-bad">{errors.branch}: usa el selector de sucursal del menú.</p>}
                {client && !client.phone && <p className="m-0 rounded-control bg-warn-bg px-3 py-2 text-sm text-warn">Este cliente no tiene celular: no le llegarán los avisos por WhatsApp.</p>}
              </>
            )}
            {branches.length > 1 && branch && (
              <p className="m-0 text-sm text-muted">
                Sucursal: <b className="font-semibold text-ink-2">{branch.name}</b>
                {!order && ' (cámbiala desde el menú lateral)'}
              </p>
            )}
          </FormSection>

          <FormSection title="Qué deja" description="Kilos, prendas o piezas especiales. El precio sale del catálogo de servicios.">
            <label className={cn('flex cursor-pointer items-center gap-3 self-start rounded-tile border px-4 py-3', express ? 'border-pop-line bg-pop-soft' : 'border-line')}>
              <Switch checked={express} onCheckedChange={setExpress} />
              <span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Zap size={15} aria-hidden className={express ? 'text-pop-ink' : 'text-muted'} /> Entrega express
                </span>
                <span className="block text-sm text-muted">
                  {settings.data ? `Lista en ${settings.data.expressHours} h en vez de ${settings.data.normalHours} h, con el precio express.` : 'Con el precio express de cada servicio.'}
                </span>
              </span>
            </label>

            <div className="flex flex-col gap-3">
              {lines.map((line) => {
                const service = byId.get(line.serviceId)
                const unit = service ? UNIT_META[service.unit] : null
                const price = service ? (express ? service.expressPrice : service.price) : null
                const sub = lineSubtotal(line, service, express)
                const q = toNumber(line.quantity)
                const belowMin = !!service?.minQuantity && Number.isFinite(q) && q > 0 && q < service.minQuantity
                return (
                  <div key={line.key} className="rounded-tile border border-line p-3.5">
                    <div className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-start gap-3 xl:grid-cols-[minmax(0,1fr)_150px_120px_auto]">
                      <Field label="Servicio" error={errors[`s${line.key}`]} className="col-span-full xl:col-span-1">
                        {(p) => (
                          <Select {...p} value={line.serviceId} onChange={(e) => setLine(line.key, { serviceId: e.target.value })}>
                            <option value="">Elige un servicio</option>
                            {catalog.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} · {formatCents(s.price)}/{UNIT_META[s.unit].per}
                              </option>
                            ))}
                            {/* Servicio ya inactivo en una orden existente: se conserva. */}
                            {line.serviceId && !service && <option value={line.serviceId}>Servicio fuera del catálogo</option>}
                          </Select>
                        )}
                      </Field>
                      <Field label={unit ? `Cantidad (${unit.many})` : 'Cantidad'} error={errors[`q${line.key}`]}>
                        {(p) => (
                          <Input
                            {...p}
                            value={line.quantity}
                            onChange={(e) => setLine(line.key, { quantity: e.target.value.replace(service?.unit === 'kg' || !service ? /[^\d.,]/g : /\D/g, '') })}
                            inputMode={service?.unit === 'kg' ? 'decimal' : 'numeric'}
                            placeholder={service?.unit === 'kg' ? '0.0' : '0'}
                            className="text-md font-semibold"
                          />
                        )}
                      </Field>
                      <div className="flex flex-col gap-[5px]">
                        <span className="text-2xs font-semibold text-muted">Subtotal</span>
                        <span className="tabular py-2 text-md font-bold">{sub !== null ? formatCents(sub) : '—'}</span>
                      </div>
                      <IconButton aria-label="Quitar línea" className="mt-6" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}>
                        <Trash2 size={17} aria-hidden />
                      </IconButton>
                    </div>
                    {service && (
                      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <Input
                          aria-label="Detalle de la línea"
                          value={line.notes}
                          onChange={(e) => setLine(line.key, { notes: e.target.value })}
                          placeholder="Detalle (opcional): 2 camisas blancas, 1 pantalón…"
                          maxLength={200}
                        />
                        <span className="text-sm text-muted">
                          {price !== null && unit ? `${formatCents(price)} por ${unit.per}` : 'Sin precio express'}
                          {belowMin && ` · se cobra el mínimo de ${service.minQuantity} ${unit!.many}`}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
              {errors.lines && <p className="m-0 text-2xs font-semibold text-bad">{errors.lines}</p>}
              <Button className="self-start" onClick={() => setLines((ls) => [...ls, newLine()])}>
                <Plus size={15} aria-hidden /> Agregar otro servicio
              </Button>
            </div>
          </FormSection>

          <FormSection title="Observaciones" description="Manchas, daños previos, botones que faltan, pedidos especiales. Salen en el ticket y te protegen ante un reclamo.">
            <Field label="Observaciones (opcional)">
              {(p) => <Textarea {...p} rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Mancha de vino en camisa blanca. Cierre del pantalón roto." maxLength={1000} />}
            </Field>
            {canPhotos && (
              <div className="flex flex-col gap-2">
                <span className="text-2xs font-semibold text-muted">Fotos (hasta {MAX_PHOTOS})</span>
                <div className="flex flex-wrap gap-2.5">
                  {photos.map((photo) => (
                    <div key={photo.key} className="relative size-24 overflow-hidden rounded-tile border border-line bg-surface-2">
                      <img src={fileUrl(photo.url)} alt="Foto de la observación" className="size-full object-cover" />
                      <button
                        type="button"
                        aria-label="Quitar foto"
                        onClick={() => setPhotos((ps) => ps.filter((x) => x.key !== photo.key))}
                        className="absolute top-1 right-1 grid size-6 cursor-pointer place-items-center rounded-full bg-ink text-surface"
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="grid size-24 cursor-pointer place-items-center rounded-tile border-[1.5px] border-dashed border-line-strong text-sm font-semibold text-ink-2 hover:border-teal hover:text-teal-ink"
                    >
                      <span className="flex flex-col items-center gap-1">
                        {uploading ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <ImagePlus size={20} aria-hidden />}
                        {uploading ? 'Subiendo…' : 'Agregar'}
                      </span>
                    </button>
                  )}
                </div>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment" className="sr-only" onChange={(e) => void addPhotos(e.target.files)} />
              </div>
            )}
          </FormSection>

          <FormSection title="Entrega" description="La fecha prometida se calcula con los plazos del negocio. Cámbiala si acordaste otra con el cliente.">
            {promised ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Fecha prometida">{(p) => <Input {...p} type="date" value={promised.date} onChange={(e) => e.target.value && setPromised({ ...promised, date: e.target.value })} />}</Field>
                <Field label="Hora">{(p) => <Input {...p} type="time" value={promised.time} onChange={(e) => e.target.value && setPromised({ ...promised, time: e.target.value })} />}</Field>
                {!order && (
                  <Button variant="ghost" onClick={() => setPromised(null)}>
                    Volver a la automática
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-md font-semibold">{autoPromised ? formatWhen(autoPromised) : '…'}</span>
                <Button size="sm" onClick={() => autoPromised && setPromised(isoToZoned(autoPromised))}>
                  Cambiar fecha
                </Button>
              </div>
            )}

            {canDeliver && (
              <>
                <LegFields title="Recojo a domicilio" hint="Pasamos por la ropa. Puedes registrar la orden ahora y pesar al llegar." leg={pickup} onChange={setLeg('pickup')} error={errors.pickup} />
                <LegFields title="Entrega a domicilio" hint="Le llevamos la ropa limpia." leg={dropoff} onChange={setLeg('dropoff')} error={errors.dropoff} />
                {(pickup.on || dropoff.on) && (
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field label="Costo del servicio a domicilio" error={errors.deliveryFee} hint="Se suma al total. Déjalo vacío si es gratis.">
                      {(p) => (
                        <div className="flex">
                          <span className="grid place-items-center rounded-l-control border border-r-0 border-line-strong bg-surface-2 px-3 text-body text-muted">S/</span>
                          <Input {...p} value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="0.00" className="rounded-l-none" />
                        </div>
                      )}
                    </Field>
                    {couriers.data && (
                      <Field label="Repartidor" hint="Solo verá las órdenes que le asignes.">
                        {(p) => (
                          <Select {...p} value={courier} onChange={(e) => setCourier(e.target.value)}>
                            <option value="">Sin asignar</option>
                            {couriers.data.map((c) => (
                              <option key={c.membershipId} value={c.membershipId}>
                                {c.name} · {c.roles}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                    )}
                  </div>
                )}
              </>
            )}
          </FormSection>

          <FormSection title="Cobro" description={order ? 'Los pagos se registran desde la ficha de la orden.' : 'Puedes cobrar todo, un adelanto o nada ahora. El saldo queda visible hasta que se pague.'}>
            {(promotions.data?.length ?? 0) > 0 && (
              <Field label="Promoción" hint={promotion ? `Descuento estimado: ${formatCents(promoDiscount)}. Si la orden no cumple las condiciones, te avisaremos al guardar.` : undefined} className="sm:max-w-[420px]">
                {(p) => (
                  <Select {...p} value={promotionId} onChange={(e) => setPromotionId(e.target.value)}>
                    <option value="">Sin promoción</option>
                    {promotions.data!.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} · − {promotionValue(x)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {!promotionId && (
            <Field label="Descuento (opcional)" error={errors.discount} className="sm:max-w-[220px]">
              {(p) => (
                <div className="flex">
                  <span className="grid place-items-center rounded-l-control border border-r-0 border-line-strong bg-surface-2 px-3 text-body text-muted">S/</span>
                  <Input {...p} value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="0.00" className="rounded-l-none" />
                </div>
              )}
            </Field>
            )}

            {!order && (
              <div className="rounded-tile border border-line p-4">
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label="Cobra ahora" error={errors.advance} hint={minAdvance > 0 ? `Adelanto mínimo: ${formatCents(minAdvance)}` : undefined}>
                    {(p) => (
                      <div className="flex">
                        <span className="grid place-items-center rounded-l-control border border-r-0 border-line-strong bg-surface-2 px-3 text-body text-muted">S/</span>
                        <Input
                          {...p}
                          value={advance.amount}
                          onChange={(e) => setAdvance({ ...advance, amount: e.target.value.replace(/[^\d.,]/g, '') })}
                          inputMode="decimal"
                          placeholder="0.00"
                          className="rounded-l-none text-md font-semibold"
                        />
                      </div>
                    )}
                  </Field>
                  <div className="flex items-end gap-2 pb-px">
                    <Button size="sm" disabled={total === 0} onClick={() => setAdvance({ ...advance, amount: (total / 100).toFixed(2) })}>
                      Todo
                    </Button>
                    <Button size="sm" disabled={total === 0} onClick={() => setAdvance({ ...advance, amount: (Math.round(total / 2) / 100).toFixed(2) })}>
                      La mitad
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAdvance({ ...advance, amount: '' })}>
                      Nada
                    </Button>
                  </div>
                </div>
                {advanceCents > 0 && (
                  <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
                    <Field label="Medio de pago">
                      {(p) => (
                        <Select {...p} value={advance.method} onChange={(e) => setAdvance({ ...advance, method: e.target.value as PaymentMethod })}>
                          {METHODS.map((m) => (
                            <option key={m} value={m}>
                              {METHOD_LABELS[m]}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    {advance.method !== 'cash' && (
                      <>
                        <Field label="N.º de operación (opcional)">
                          {(p) => <Input {...p} value={advance.reference} onChange={(e) => setAdvance({ ...advance, reference: e.target.value })} maxLength={60} />}
                        </Field>
                        <div className="sm:col-span-2">
                          <ProofUpload upload={uploadPaymentProof} onChange={(key) => setAdvance((a) => ({ ...a, proofKey: key }))} label="Foto del comprobante (opcional)" />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 rounded-tile bg-surface-2 p-4 text-body">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular m-0 text-right">{formatCents(subtotal)}</dd>
              {discountCents > 0 && (
                <>
                  <dt className="text-muted">Descuento</dt>
                  <dd className="tabular m-0 text-right">− {formatCents(discountCents)}</dd>
                </>
              )}
              {feeCents > 0 && (
                <>
                  <dt className="text-muted">Servicio a domicilio</dt>
                  <dd className="tabular m-0 text-right">{formatCents(feeCents)}</dd>
                </>
              )}
              <dt className="mt-1 border-t border-line-strong pt-2 text-md font-bold">Total</dt>
              <dd className="tabular m-0 mt-1 border-t border-line-strong pt-2 text-right text-md font-bold">{formatCents(total)}</dd>
              <dt className="text-muted">{order ? 'Ya cobrado' : 'Cobra ahora'}</dt>
              <dd className="tabular m-0 text-right">{formatCents(paid)}</dd>
              <dt className="text-md font-bold text-pop-ink">Saldo</dt>
              <dd className="tabular m-0 text-right text-xl font-bold text-pop-ink">{formatCents(Math.max(total - paid, 0))}</dd>
            </dl>
          </FormSection>

          <FormActions hint={pickupPending && filled.length === 0 ? 'Recojo sin pesar: completarás los servicios al llegar la ropa.' : undefined}>
            <Button onClick={() => navigate(back)}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={uploading}>
              {busy ? 'Guardando…' : order ? 'Guardar cambios' : 'Registrar orden'}
            </Button>
          </FormActions>
        </fieldset>
      </form>
    </Card>
  )
}

/** Órdenes / nueva o editar: página completa. `?cliente=<id>` preselecciona al cliente. */
export function OrderFormPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const order = useOrder(id)
  const preset = useClient(id ? undefined : (params.get('cliente') ?? undefined))
  const editing = !!id
  usePageMeta({
    title: editing ? `Editar ${order.data?.ticket ?? 'orden'}` : 'Nueva orden',
    crumb: editing ? `Órdenes / ${order.data?.ticket ?? ''} / Editar` : 'Órdenes / Nueva',
  })

  const closed = order.data && (order.data.status === 'delivered' || order.data.status === 'cancelled')
  return (
    <>
      <BackLink to={editing ? `/ordenes/${id}` : '/ordenes'} label={editing ? (order.data?.ticket ?? 'Orden') : 'Órdenes'} />
      {(editing && order.isLoading) || preset.isLoading ? (
        <Skeleton className="h-[520px] rounded-card" />
      ) : editing && (!order.data || closed) ? (
        <Card>
          <EmptyState
            icon={Shirt}
            title={closed ? 'Esta orden ya no se puede editar' : 'No encontramos esta orden'}
            description={closed ? 'Las órdenes entregadas o anuladas quedan como están.' : undefined}
            action={
              <Link to={closed ? `/ordenes/${id}` : '/ordenes'} className="text-sm font-semibold text-brand hover:underline">
                Volver
              </Link>
            }
          />
        </Card>
      ) : (
        <OrderForm key={order.data?.id ?? preset.data?.id ?? 'new'} order={order.data ?? null} initialClient={preset.data ?? null} />
      )}
    </>
  )
}
