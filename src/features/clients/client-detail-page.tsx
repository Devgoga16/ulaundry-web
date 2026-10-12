import { IdCard, MapPin, MessageCircle, Phone, Plus, UserX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Avatar } from '@/components/ui/avatar'
import { Tag } from '@/components/ui/badges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/display'
import { BackLink, RouteTabs, useTab } from '@/components/ui/page'
import { formatWhen, itemsSummary, useOrders } from '@/features/orders/api'
import { StatusChip } from '@/features/orders/status-chip'
import { useAccess } from '@/lib/auth/access'
import { formatCents } from '@/lib/format'
import { usePageMeta } from '@/lib/page-meta'
import { formatDate, formatPhone, fullName, useClient, useUpdateClient } from './api'
import { ClientForm } from './client-form'

const TABS = ['ordenes', 'datos'] as const
type Tab = (typeof TABS)[number]

function Contact({ icon: Icon, children }: { icon: typeof Phone; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <Icon size={13} aria-hidden /> {children}
    </span>
  )
}

/** Perfil del cliente: quién es y su relación con el negocio, con pestañas por tema. */
export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { can, readOnly } = useAccess()
  const client = useClient(id)
  const update = useUpdateClient(id ?? '')
  const navigate = useNavigate()
  const seesOrders = can('order.read')
  const tab = useTab<Tab>(TABS, seesOrders ? 'ordenes' : 'datos')
  const orders = useOrders({ clientId: id, limit: 50 }, seesOrders && !!id)

  const c = client.data
  usePageMeta(c ? { title: fullName(c), crumb: `Clientes / ${fullName(c)}` } : null)

  if (client.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[130px] rounded-card" />
        <Skeleton className="h-[300px] rounded-card" />
      </div>
    )
  }
  if (!c) {
    return (
      <Card>
        <EmptyState
          icon={UserX}
          title="No encontramos a este cliente"
          action={
            <Link to="/clientes" className="text-sm font-semibold text-brand hover:underline">
              Volver a Clientes
            </Link>
          }
        />
      </Card>
    )
  }

  const digits = c.phone?.replace(/\D/g, '')
  const address = [c.address, c.district].filter(Boolean).join(', ')
  const history = orders.data?.items ?? []
  const live = history.filter((o) => o.status !== 'cancelled')
  const owed = live.reduce((sum, o) => sum + o.balance, 0)

  return (
    <>
      <BackLink to="/clientes" label="Clientes" />

      <Card className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={fullName(c)} size="lg" round className="size-16 text-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 text-xl font-semibold">{fullName(c)}</h2>
              {c.tags.map((t) => (
                <Tag key={t} tone={t.toLowerCase() === 'vip' ? 'brand' : 'off'}>
                  {t}
                </Tag>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {c.phone && <Contact icon={Phone}>{formatPhone(c.phone)}</Contact>}
              {c.documentId && <Contact icon={IdCard}>{c.documentId}</Contact>}
              {address && <Contact icon={MapPin}>{address}</Contact>}
            </div>
            <div className="mt-1 text-xs text-muted">
              {c.createdAt && `Cliente desde ${formatDate(c.createdAt)}`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {can('order.create') && !readOnly && (
            <Button variant="primary" onClick={() => navigate(`/ordenes/nueva?cliente=${c.id}`)}>
              <Plus size={15} aria-hidden /> Nueva orden
            </Button>
          )}
          {digits && digits.length >= 9 && (
            <a
              href={`https://wa.me/51${digits.slice(-9)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink-2 hover:border-teal"
            >
              <MessageCircle size={14} aria-hidden /> WhatsApp
            </a>
          )}
        </div>

        {c.notes && (
          <p className="m-0 rounded-[10px] bg-warn-bg px-4 py-3 text-sm whitespace-pre-line text-warn">
            <b className="font-semibold">Nota: </b>
            {c.notes}
          </p>
        )}
      </Card>

      <RouteTabs<Tab>
        fallback={seesOrders ? 'ordenes' : 'datos'}
        tabs={[
          ...(seesOrders
            ? [{ value: 'ordenes' as const, label: 'Órdenes', badge: orders.data?.total ? <span className="rounded-full bg-teal-soft px-1.5 text-2xs text-teal-ink">{orders.data.total}</span> : undefined }]
            : []),
          { value: 'datos', label: 'Datos' },
        ]}
      />

      {tab === 'ordenes' && seesOrders && (
        <Card>
          {orders.isLoading ? (
            <Skeleton className="h-[160px]" />
          ) : history.length === 0 ? (
            <p className="m-0 py-4 text-center text-sm text-muted">Todavía no tiene órdenes.</p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-x-8 gap-y-2 border-b border-line pb-3.5">
                <div>
                  <div className="text-sm text-muted">Órdenes</div>
                  <div className="tabular text-xl font-bold">{live.length}</div>
                </div>
                <div>
                  <div className="text-sm text-muted">Total</div>
                  <div className="tabular text-xl font-bold">{formatCents(live.reduce((sum, o) => sum + o.total, 0))}</div>
                </div>
                <div>
                  <div className="text-sm text-muted">Saldo pendiente</div>
                  <div className={owed > 0 ? 'tabular text-xl font-bold text-pop-ink' : 'tabular text-xl font-bold'}>{formatCents(owed)}</div>
                </div>
              </div>
              <ul className="m-0 list-none p-0">
                {history.map((o) => (
                  <li key={o.id} className="border-t border-line first:border-t-0">
                    <Link to={`/ordenes/${o.id}`} className="-mx-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-control px-2 py-3 text-ink hover:bg-surface-2">
                      <span className="tabular w-[88px] font-bold">{o.ticket}</span>
                      <span className="min-w-[160px] flex-1">
                        <span className="block truncate text-body">{itemsSummary(o.items)}</span>
                        <span className="block text-sm text-muted">{formatWhen(o.createdAt)}</span>
                      </span>
                      <StatusChip status={o.status} />
                      <span className="w-[110px] text-right">
                        <span className="tabular block font-semibold">{formatCents(o.total)}</span>
                        {o.balance > 0 && <span className="tabular block text-sm font-semibold text-pop-ink">debe {formatCents(o.balance)}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {tab === 'datos' && (
        <Card>
          <ClientForm
            key={c.id}
            client={c}
            readOnly={readOnly || !can('client.update')}
            submitLabel="Guardar cambios"
            onSubmit={(input) => update.mutateAsync(input)}
          />
        </Card>
      )}
    </>
  )
}
