import { ChevronLeft, ChevronRight, Hourglass, PackageCheck, Plus, Search, Shirt, Truck, Wallet, WashingMachine } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FilterChips } from '@/components/ui/controls'
import { EmptyState, Skeleton, Table, Td, Th, Tr } from '@/components/ui/display'
import { Input } from '@/components/ui/field'
import { Kpi } from '@/components/ui/kpi'
import { formatPhone } from '@/features/clients/api'
import { errorMessage } from '@/lib/api/client'
import { useAccess } from '@/lib/auth/access'
import { useBranch } from '@/lib/auth/branch-context'
import { cn } from '@/lib/cn'
import { formatCents } from '@/lib/format'
import { formatWhen, itemsSummary, useOrders, useOrderSummary, type OrderRow, type OrderStatus, type OrderView } from './api'
import { ExpressTag, LocationTag, StatusChip } from './status-chip'

type Tab = 'open' | OrderStatus | 'unclaimed' | 'with_balance' | 'delivery' | 'all'
const TABS: Tab[] = ['open', 'received', 'in_process', 'ready', 'delivered', 'unclaimed', 'with_balance', 'delivery', 'cancelled', 'all']
const STATUS_TABS: Tab[] = ['received', 'in_process', 'ready', 'delivered', 'cancelled']

/** Qué decir de la fecha según el estado: prometida, lista hace N días o entregada. */
function WhenCell({ o }: { o: OrderRow }) {
  if (o.status === 'delivered') return <span className="text-muted">Entregada {formatWhen(o.deliveredAt)}</span>
  if (o.status === 'cancelled') return <span className="text-muted">Anulada {formatWhen(o.cancelledAt)}</span>
  if (o.status === 'ready') {
    return (
      <span className={cn(o.unclaimed ? 'font-semibold text-bad' : o.daysReady ? 'font-semibold text-pop-ink' : 'text-ink-2')}>
        {o.daysReady ? `${o.daysReady} ${o.daysReady === 1 ? 'día' : 'días'} sin recoger` : `Lista ${formatWhen(o.readyAt)}`}
      </span>
    )
  }
  return (
    <span className={cn(o.overdue && 'font-semibold text-bad')}>
      {formatWhen(o.promisedAt)}
      {o.overdue && <span className="block text-xs">Atrasada</span>}
    </span>
  )
}

/** Órdenes: cifras del día, filtros por estado, búsqueda y la lista paginada. */
export function OrdersPage() {
  const navigate = useNavigate()
  const { can, hasFeature, readOnly } = useAccess()
  const { current } = useBranch()
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('ver') as Tab) ? (params.get('ver') as Tab) : 'open'
  const page = Math.max(1, Number(params.get('pagina')) || 1)
  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search)
  const delivery = hasFeature('home_delivery')

  const summary = useOrderSummary(current?.id)
  const isStatus = STATUS_TABS.includes(tab)
  const orders = useOrders({
    branchId: current?.id,
    status: isStatus ? (tab as OrderStatus) : undefined,
    view: isStatus ? undefined : (tab as OrderView),
    search: deferred.trim() || undefined,
    page,
  })
  const s = summary.data
  const data = orders.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const canCreate = can('order.create') && !readOnly

  const go = (next: Tab, nextPage = 1) => {
    const p = new URLSearchParams()
    if (next !== 'open') p.set('ver', next)
    if (nextPage > 1) p.set('pagina', String(nextPage))
    setParams(p, { replace: true })
  }
  const n = (v: number | undefined) => (v === undefined ? '' : ` · ${v}`)

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={WashingMachine} label="Por terminar" value={s ? String(s.received + s.inProcess) : '—'} detail={s ? `${s.overdue} ${s.overdue === 1 ? 'atrasada' : 'atrasadas'}` : undefined} onClick={() => go('in_process')} />
        <Kpi icon={PackageCheck} label="Listas por recoger" value={s ? String(s.ready) : '—'} detail={s ? `${s.unclaimed} no recogidas` : undefined} onClick={() => go('ready')} />
        <Kpi icon={Hourglass} label="Se entregan hoy" value={s ? String(s.dueToday) : '—'} detail="Prometidas para hoy" />
        <Kpi icon={Wallet} label="Saldo por cobrar" value={s ? formatCents(s.balance) : '—'} detail={s ? `${s.ordersWithBalance} ${s.ordersWithBalance === 1 ? 'orden' : 'órdenes'}` : undefined} onClick={() => go('with_balance')} featured />
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[240px] flex-1 sm:max-w-[380px]">
            <span className="sr-only">Buscar orden</span>
            <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                if (page !== 1) go(tab)
              }}
              placeholder="Ticket, cliente, celular o ubicación"
              className="pl-9"
            />
          </label>
          {canCreate && (
            <Button variant="primary" className="ml-auto" onClick={() => navigate('/ordenes/nueva')}>
              <Plus size={15} aria-hidden /> Nueva orden
            </Button>
          )}
        </div>

        <FilterChips<Tab>
          aria-label="Filtro"
          value={tab}
          onValueChange={(v) => go(v)}
          options={[
            { value: 'open', label: `En el local${n(s && s.received + s.inProcess + s.ready)}` },
            { value: 'received', label: `Recibidas${n(s?.received)}` },
            { value: 'in_process', label: `En proceso${n(s?.inProcess)}` },
            { value: 'ready', label: `Listas${n(s?.ready)}` },
            { value: 'delivered', label: 'Entregadas' },
            { value: 'unclaimed', label: `No recogidas${n(s?.unclaimed)}` },
            { value: 'with_balance', label: `Con saldo${n(s?.ordersWithBalance)}` },
            ...(delivery ? [{ value: 'delivery' as const, label: `A domicilio${n(s?.pendingPickups)}` }] : []),
            { value: 'cancelled', label: 'Anuladas' },
            { value: 'all', label: 'Todas' },
          ]}
        />

        {orders.isError ? (
          <p className="m-0 text-sm font-semibold text-bad">{errorMessage(orders.error)}</p>
        ) : orders.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          deferred ? (
            <p className="m-0 py-8 text-center text-sm text-muted">Ninguna orden coincide con "{deferred}".</p>
          ) : tab === 'open' ? (
            <EmptyState
              icon={Shirt}
              title="No hay órdenes en el local"
              description="Cuando recibas ropa, regístrala aquí: el cliente recibe su ticket por WhatsApp y tú sabes siempre dónde está cada orden."
              action={
                canCreate && (
                  <Button variant="primary" size="sm" onClick={() => navigate('/ordenes/nueva')}>
                    <Plus size={14} aria-hidden /> Registrar una orden
                  </Button>
                )
              }
            />
          ) : (
            <p className="m-0 py-8 text-center text-sm text-muted">No hay órdenes en este filtro.</p>
          )
        ) : (
          <>
            <Table aria-busy={orders.isFetching} className={orders.isPlaceholderData ? 'opacity-60' : undefined}>
              <thead>
                <tr>
                  <Th>Ticket</Th>
                  <Th>Cliente</Th>
                  <Th className="hidden lg:table-cell">Detalle</Th>
                  <Th>Estado</Th>
                  <Th className="hidden sm:table-cell">Ubicación</Th>
                  <Th className="hidden md:table-cell">Entrega</Th>
                  <Th className="text-right">Saldo</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <Tr key={o.id} onClick={() => navigate(`/ordenes/${o.id}`)}>
                    <Td>
                      <Link to={`/ordenes/${o.id}`} onClick={(e) => e.stopPropagation()} className="text-md font-bold text-ink hover:underline">
                        {o.ticket}
                      </Link>
                      {o.express && (
                        <div className="mt-1">
                          <ExpressTag />
                        </div>
                      )}
                    </Td>
                    <Td className="whitespace-normal">
                      <div className="font-semibold">{o.clientName}</div>
                      <div className="text-xs text-muted">{formatPhone(o.clientPhone) || 'Sin celular'}</div>
                    </Td>
                    <Td className="hidden max-w-[280px] whitespace-normal lg:table-cell">
                      <span className="line-clamp-2 text-sm text-ink-2">{itemsSummary(o.items)}</span>
                      {(o.pickup?.status === 'pending' || o.dropoff?.status === 'pending') && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-teal-ink">
                          <Truck size={13} aria-hidden /> {o.pickup?.status === 'pending' ? 'Recojo pendiente' : 'Entrega a domicilio'}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <StatusChip status={o.status} />
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <LocationTag location={o.location} />
                    </Td>
                    <Td className="hidden whitespace-normal md:table-cell">
                      <WhenCell o={o} />
                    </Td>
                    <Td className="text-right">
                      {o.balance > 0 ? <span className="text-md font-bold text-pop-ink">{formatCents(o.balance)}</span> : <span className="text-muted">{o.status === 'cancelled' ? '—' : 'Pagada'}</span>}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            <div className="flex items-center justify-between gap-3 text-sm text-muted">
              <span>
                {(data.page - 1) * data.pageSize + 1}–{(data.page - 1) * data.pageSize + data.items.length} de {data.total}
              </span>
              {pages > 1 && (
                <div className="flex items-center gap-1">
                  <IconButton aria-label="Página anterior" disabled={page <= 1} onClick={() => go(tab, page - 1)}>
                    <ChevronLeft size={18} aria-hidden />
                  </IconButton>
                  <span className="tabular px-1">
                    {page} / {pages}
                  </span>
                  <IconButton aria-label="Página siguiente" disabled={page >= pages} onClick={() => go(tab, page + 1)}>
                    <ChevronRight size={18} aria-hidden />
                  </IconButton>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  )
}
