import { Check, ChevronRight, Clock, Hourglass, ImagePlus, PackageCheck, Plus, Store, Tags, UserPlus, Users, Wallet, WashingMachine, type LucideIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/display'
import { Kpi, KpiFlat } from '@/components/ui/kpi'
import { useBranchesWithHours } from '@/features/branches/api'
import { formatPhone, useClientSummary } from '@/features/clients/api'
import { formatWhen, itemsSummary, useOrders, useOrderSummary, useServices, type OrderRow } from '@/features/orders/api'
import { LocationTag, StatusChip } from '@/features/orders/status-chip'
import { useOrganizationProfile } from '@/features/settings/api'
import { useMembers } from '@/features/team/api'
import { useAccess } from '@/lib/auth/access'
import { useAuth } from '@/lib/auth/auth-context'
import { useBranch } from '@/lib/auth/branch-context'
import { formatCents } from '@/lib/format'
import { cn } from '@/lib/cn'

interface Step {
  icon: LucideIcon
  title: string
  detail: string
  to: string
  done: boolean
}

function StepRow({ step }: { step: Step }) {
  const Icon = step.icon
  return (
    <li className="border-t border-line first:border-t-0">
      <Link to={step.to} className="-mx-2 flex items-center gap-3.5 rounded-control px-2 py-3.5 text-ink hover:bg-surface-2">
        <span
          className={cn(
            'grid size-10 flex-none place-items-center rounded-tile',
            step.done ? 'bg-ok-bg text-ok' : 'bg-pop-soft text-pop-ink',
          )}
        >
          {step.done ? <Check size={19} aria-hidden /> : <Icon size={19} aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block font-semibold', step.done && 'text-muted line-through decoration-1')}>{step.title}</span>
          <span className="block text-sm text-muted">{step.detail}</span>
        </span>
        <span className="hidden text-sm font-semibold text-muted sm:block">{step.done ? 'Hecho' : 'Pendiente'}</span>
        <ChevronRight size={18} className="flex-none text-muted" aria-hidden />
      </Link>
    </li>
  )
}

function OrderList({ title, empty, orders, to }: { title: string; empty: string; orders: OrderRow[] | undefined; to: string }) {
  return (
    <Card>
      <CardHeader
        title={title}
        actions={
          <Link to={to} className="text-sm font-semibold text-brand hover:underline">
            Ver todas
          </Link>
        }
      />
      {!orders ? (
        <Skeleton className="h-[120px]" />
      ) : orders.length === 0 ? (
        <p className="m-0 py-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {orders.map((o) => (
            <li key={o.id} className="border-t border-line first:border-t-0">
              <Link to={`/ordenes/${o.id}`} className="-mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control px-2 py-3 text-ink hover:bg-surface-2">
                <span className="tabular w-[84px] font-bold">{o.ticket}</span>
                <span className="min-w-[140px] flex-1">
                  <span className="block truncate font-semibold">{o.clientName}</span>
                  <span className="block truncate text-sm text-muted">{o.status === 'ready' ? formatPhone(o.clientPhone) || 'Sin celular' : itemsSummary(o.items)}</span>
                </span>
                {o.status === 'ready' ? <LocationTag location={o.location} /> : <StatusChip status={o.status} />}
                <span className={cn('w-[150px] text-right text-sm', (o.overdue || o.unclaimed) && 'font-semibold text-bad')}>
                  {o.status === 'ready' ? (o.daysReady ? `${o.daysReady} ${o.daysReady === 1 ? 'día' : 'días'} esperando` : 'Lista hoy') : formatWhen(o.promisedAt)}
                </span>
                {o.balance > 0 && <span className="tabular w-[84px] text-right font-bold text-pop-ink">{formatCents(o.balance)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Inicio: el día de la lavandería de un vistazo y lo que falta configurar. */
export function HomePage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const { can, readOnly } = useAccess()
  const { current } = useBranch()
  const canManage = can('organization.manage')
  const seesOrders = can('order.read')
  const summary = useOrderSummary(current?.id, seesOrders)
  const ready = useOrders({ branchId: current?.id, status: 'ready', limit: 6 }, seesOrders)
  const working = useOrders({ branchId: current?.id, view: 'due_today', limit: 6 }, seesOrders)
  const overdue = useOrders({ branchId: current?.id, view: 'overdue', limit: 6 }, seesOrders)
  const services = useServices(false, can('service.read'))
  const sum = summary.data
  const org = useOrganizationProfile()
  const branches = useBranchesWithHours()
  const members = useMembers(can('member.read'))
  const clients = useClientSummary(can('client.read'))

  const activeBranches = (branches.data ?? []).filter((b) => b.isActive)
  const pay = org.data?.paymentInfo
  const steps: Step[] = [
    {
      icon: Tags,
      title: 'Crea tus servicios y precios',
      detail: 'Lavado por kilo, planchado por prenda, edredones… Sin ellos no puedes registrar órdenes.',
      to: '/servicios',
      done: (services.data ?? []).length > 0,
    },
    {
      icon: Wallet,
      title: 'Indica dónde te pagan',
      detail: 'Tu Yape, Plin o cuenta: salen en el ticket y en el portal del cliente.',
      to: '/configuracion',
      done: !!pay && !!(pay.yape || pay.plin || pay.bank),
    },
    {
      icon: Clock,
      title: 'Define tu horario de atención',
      detail: 'Para que el cliente sepa cuándo puede recoger su ropa.',
      to: activeBranches[0] ? `/sucursales/${activeBranches[0].id}` : '/sucursales',
      done: activeBranches.some((b) => b.openingHours.some((d) => d.intervals.length > 0)),
    },
    {
      icon: ImagePlus,
      title: 'Sube tu logo',
      detail: 'Reemplaza las iniciales en el menú, el ticket y el portal.',
      to: '/configuracion',
      done: !!org.data?.logoUrl,
    },
    {
      icon: UserPlus,
      title: 'Invita a tu equipo',
      detail: 'Recepción, operarios y repartidores: cada quien ve solo lo que le toca.',
      to: '/equipo',
      done: (members.data ?? []).filter((m) => m.status === 'active').length > 1,
    },
  ]
  const pending = steps.filter((s) => !s.done).length
  const loading = org.isLoading || branches.isLoading || services.isLoading

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-semibold tracking-[.08em] text-muted uppercase">
            {me?.organization?.name}
            {current && ` · ${current.name}`}
          </p>
          <h2 className="m-0 mt-1 text-3xl leading-tight font-bold tracking-[-.02em]">{me?.context.supportView ? 'Resumen del negocio' : `Hola, ${me?.user.firstName ?? ''}`}</h2>
        </div>
        {can('order.create') && !readOnly && (
          <Button variant="primary" onClick={() => navigate('/ordenes/nueva')}>
            <Plus size={16} aria-hidden /> Nueva orden
          </Button>
        )}
      </div>

      {seesOrders && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={WashingMachine} label="Por terminar" value={sum ? String(sum.received + sum.inProcess) : '—'} detail={sum ? `${sum.overdue} ${sum.overdue === 1 ? 'atrasada' : 'atrasadas'}` : undefined} onClick={() => navigate('/ordenes?ver=in_process')} />
            <Kpi icon={PackageCheck} label="Listas por recoger" value={sum ? String(sum.ready) : '—'} detail={sum ? `${sum.unclaimed} no recogidas` : undefined} onClick={() => navigate('/ordenes?ver=ready')} />
            <Kpi icon={Hourglass} label="Se entregan hoy" value={sum ? String(sum.dueToday) : '—'} detail="Prometidas para hoy" />
            <Kpi icon={Wallet} label="Saldo por cobrar" value={sum ? formatCents(sum.balance) : '—'} detail={sum ? `${sum.ordersWithBalance} ${sum.ordersWithBalance === 1 ? 'orden' : 'órdenes'}` : undefined} onClick={() => navigate('/ordenes?ver=with_balance')} featured />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <OrderList
              title="Por terminar hoy"
              empty="No hay órdenes prometidas para hoy."
              orders={working.data && overdue.data ? [...overdue.data.items, ...working.data.items.filter((o) => !o.overdue)].slice(0, 6) : undefined}
              to="/ordenes?ver=in_process"
            />
            <OrderList title="Listas esperando al cliente" empty="No hay órdenes listas por recoger." orders={ready.data?.items} to="/ordenes?ver=ready" />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {can('client.read') && <KpiFlat icon={Users} label="Clientes" value={clients.data ? String(clients.data.total) : '—'} />}
        <KpiFlat icon={Store} label="Sucursales activas" value={branches.data ? String(activeBranches.length) : '—'} />
        {can('member.read') && (
          <KpiFlat icon={UserPlus} label="Personas en el equipo" value={members.data ? String(members.data.filter((m) => m.status === 'active').length) : '—'} />
        )}
      </div>

      {canManage && (loading || pending > 0) && (
        <Card>
          <CardHeader
            title="Deja lista tu lavandería"
            actions={
              !loading && (
                <span className={cn('rounded-full px-3 py-1 text-sm font-semibold', pending ? 'bg-pop-soft text-pop-ink' : 'bg-ok-bg text-ok')}>
                  {pending ? `${pending} de ${steps.length} por hacer` : 'Todo listo'}
                </span>
              )
            }
          />
          {loading ? (
            <Skeleton className="h-[220px]" />
          ) : (
            <ul className="m-0 list-none p-0">
              {steps.map((s) => (
                <StepRow key={s.title} step={s} />
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  )
}
