import { Check, MapPin, MessageCircle, PackageCheck, Phone, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/display'
import { formatPhone } from '@/features/clients/api'
import { errorMessage } from '@/lib/api/client'
import { useAccess } from '@/lib/auth/access'
import { useBranch } from '@/lib/auth/branch-context'
import { formatCents } from '@/lib/format'
import { itemsSummary, useOrderActions, useOrders, type DeliveryLeg, type OrderRow } from './api'
import { StatusChip } from './status-chip'

const linkClass = 'inline-flex items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3 py-2 text-sm font-semibold text-ink-2 hover:border-teal'

function Stop({ order, leg, kind, action }: { order: OrderRow; leg: DeliveryLeg; kind: 'pickup' | 'dropoff'; action?: React.ReactNode }) {
  const digits = order.clientPhone.replace(/\D/g, '')
  const where = [leg.address, leg.district].filter(Boolean).join(', ')
  return (
    <li className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/ordenes/${order.id}`} className="tabular text-md font-bold text-ink hover:underline">
              {order.ticket}
            </Link>
            <span className="font-semibold">{order.clientName}</span>
            {kind === 'dropoff' && order.status !== 'ready' && <StatusChip status={order.status} />}
          </div>
          <div className="mt-1 flex items-start gap-1.5 text-body">
            <MapPin size={16} aria-hidden className="mt-0.5 flex-none text-teal-ink" />
            <span>
              {where}
              {leg.reference && <span className="block text-sm text-muted">{leg.reference}</span>}
            </span>
          </div>
          <div className="mt-1 text-sm text-ink-2">
            {leg.window && <b className="font-semibold">{leg.window} · </b>}
            {kind === 'pickup' && order.items.length === 0 ? 'Por pesar' : itemsSummary(order.items)}
          </div>
        </div>
        {order.balance > 0 && (
          <div className="text-right">
            <div className="text-sm text-muted">{kind === 'dropoff' ? 'Cobrar al entregar' : 'Saldo'}</div>
            <div className="tabular text-xl font-bold text-pop-ink">{formatCents(order.balance)}</div>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {action}
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`} target="_blank" rel="noreferrer" className={linkClass}>
          <MapPin size={15} aria-hidden /> Cómo llegar
        </a>
        {digits.length >= 9 && (
          <>
            <a href={`tel:+51${digits.slice(-9)}`} className={linkClass}>
              <Phone size={15} aria-hidden /> {formatPhone(order.clientPhone)}
            </a>
            <a href={`https://wa.me/51${digits.slice(-9)}`} target="_blank" rel="noreferrer" className={linkClass}>
              <MessageCircle size={15} aria-hidden /> WhatsApp
            </a>
          </>
        )}
      </div>
    </li>
  )
}

function Section({ title, hint, children, count }: { title: string; hint: string; children: React.ReactNode; count: number }) {
  if (count === 0) return null
  return (
    <Card>
      <h3 className="m-0 text-md font-bold">
        {title} · {count}
      </h3>
      <p className="m-0 mb-3 text-sm text-muted">{hint}</p>
      <ul className="m-0 list-none p-0">{children}</ul>
    </Card>
  )
}

/** Domicilio: los recojos y entregas pendientes. El repartidor ve solo los que tiene asignados. */
export function DeliveriesPage() {
  const { can, scope, readOnly } = useAccess()
  const { current } = useBranch()
  const mine = scope('order.read') === 'own'
  const orders = useOrders({ view: 'delivery', branchId: mine ? undefined : current?.id, limit: 100 })
  const { completeLeg } = useOrderActions()
  const [error, setError] = useState<string | null>(null)
  const canAct = can('order.deliver') && !readOnly

  const list = orders.data?.items ?? []
  const pickups = list.filter((o) => o.pickup?.status === 'pending')
  const toDeliver = list.filter((o) => o.dropoff?.status === 'pending' && o.status === 'ready')
  const preparing = list.filter((o) => o.dropoff?.status === 'pending' && o.status !== 'ready' && o.pickup?.status !== 'pending')

  return (
    <>
      <p className="m-0 text-sm text-muted">{mine ? 'Estos son los recojos y entregas que tienes asignados.' : `Recojos y entregas pendientes${current ? ` de ${current.name}` : ''}. Asigna el repartidor al editar cada orden.`}</p>
      {error && (
        <p role="alert" className="m-0 rounded-control bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">
          {error}
        </p>
      )}
      {orders.isLoading ? (
        <Skeleton className="h-[280px] rounded-card" />
      ) : orders.isError ? (
        <p className="m-0 text-sm font-semibold text-bad">{errorMessage(orders.error)}</p>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={Truck} title="No hay recojos ni entregas pendientes" description={mine ? 'Cuando te asignen una orden a domicilio aparecerá aquí.' : 'Al registrar una orden puedes marcar recojo o entrega a domicilio.'} />
        </Card>
      ) : (
        <>
          <Section title="Recojos por hacer" hint="Pasa por la ropa. Se pesa y se completa la orden al llegar al local." count={pickups.length}>
            {pickups.map((o) => (
              <Stop
                key={o.id}
                order={o}
                leg={o.pickup!}
                kind="pickup"
                action={
                  canAct && (
                    <Button
                      variant="primary"
                      disabled={completeLeg.isPending}
                      onClick={() => {
                        setError(null)
                        completeLeg.mutate({ id: o.id, leg: 'pickup' }, { onError: (e) => setError(errorMessage(e)) })
                      }}
                    >
                      <Check size={15} aria-hidden /> Ya la recogí
                    </Button>
                  )
                }
              />
            ))}
          </Section>

          <Section title="Listas para llevar" hint="La ropa ya está lista. Al entregarla, cobra el saldo si lo hay." count={toDeliver.length}>
            {toDeliver.map((o) => (
              <Stop
                key={o.id}
                order={o}
                leg={o.dropoff!}
                kind="dropoff"
                action={
                  canAct && (
                    <Link to={`/ordenes/${o.id}`} className="bg-grad inline-flex items-center gap-1.5 rounded-control px-3.5 py-2 text-sm font-semibold hover:brightness-110">
                      <PackageCheck size={15} aria-hidden /> {o.balance > 0 ? 'Cobrar y entregar' : 'Entregar'}
                    </Link>
                  )
                }
              />
            ))}
          </Section>

          <Section title="Entregas en preparación" hint="Todavía se están lavando. Aparecerán arriba cuando estén listas." count={preparing.length}>
            {preparing.map((o) => (
              <Stop key={o.id} order={o} leg={o.dropoff!} kind="dropoff" />
            ))}
          </Section>
        </>
      )}
    </>
  )
}
