import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Clock, Receipt, Scale, Shirt, Timer, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Card, CardHeader } from '@/components/ui/card'
import { FilterChips, Segmented } from '@/components/ui/controls'
import { Skeleton, Table, Td, Th } from '@/components/ui/display'
import { Input, Select } from '@/components/ui/field'
import { Kpi } from '@/components/ui/kpi'
import { METHOD_LABELS, STATUS_META, UNIT_META, type OrderStatus, type PaymentMethod, type ServiceUnit } from '@/features/orders/api'
import { api, errorMessage } from '@/lib/api/client'
import { useAccess } from '@/lib/auth/access'
import { useBranch } from '@/lib/auth/branch-context'
import { cn } from '@/lib/cn'
import { formatCents } from '@/lib/format'
import { addDaysYmd, todayLocal } from '@/lib/time'

interface Overview {
  range: { from: string; to: string; days: number }
  branchId: string | null
  features: { advanced: boolean; byBranch: boolean }
  summary: {
    orders: number
    kilos: number
    billed: number
    collected: number
    discounts: number
    expressOrders: number
    averageTicket: number
    byStatus: Record<OrderStatus, number>
  }
  services: Array<{ serviceId: string; name: string; category: string; unit: ServiceUnit; quantity: number; orders: number; income: number; share: number }> | null
  times: { readyOrders: number; hoursToReady: number | null; onTimePercent: number | null; hoursToPickup: number | null } | null
  daily: Array<{ date: string; orders: number; kilos: number; collected: number }> | null
  methods: Array<{ method: PaymentMethod; amount: number; count: number }> | null
  branches: Array<{ branchId: string; name: string; orders: number; billed: number; collected: number }> | null
}

type Preset = '7' | '30' | 'month' | 'custom'
type Metric = 'orders' | 'kilos' | 'collected'

const STATUS_BAR: Record<OrderStatus, string> = { received: 'bg-brand', in_process: 'bg-teal', ready: 'bg-pop', delivered: 'bg-ok', cancelled: 'bg-off' }
const STATUSES: OrderStatus[] = ['received', 'in_process', 'ready', 'delivered', 'cancelled']

/** "26.5 h" o "2.1 días" */
function duration(hours: number | null): string {
  if (hours === null) return '—'
  return hours >= 48 ? `${(hours / 24).toFixed(1)} días` : `${hours} h`
}

function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  return (
    <span className="block h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
      <span className={cn('block h-full rounded-full', className ?? 'bg-teal')} style={{ width: `${max ? Math.max((value / max) * 100, value ? 2 : 0) : 0}%` }} />
    </span>
  )
}

/** Barras por día. Cada barra tiene su valor como texto accesible. */
function DailyChart({ daily, metric }: { daily: NonNullable<Overview['daily']>; metric: Metric }) {
  const max = Math.max(...daily.map((d) => d[metric]), 1)
  const fmt = (v: number) => (metric === 'collected' ? formatCents(v) : metric === 'kilos' ? `${v} kg` : `${v} ${v === 1 ? 'orden' : 'órdenes'}`)
  const label = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`
  const step = Math.ceil(daily.length / 10)
  return (
    <div>
      <div className="flex h-[180px] items-end gap-[3px]" role="img" aria-label={`Evolución diaria. Máximo: ${fmt(max)}.`}>
        {daily.map((d) => (
          <div key={d.date} className="group relative flex h-full min-w-0 flex-1 items-end" title={`${label(d.date)}: ${fmt(d[metric])}`}>
            <div className={cn('w-full rounded-t-[4px]', d[metric] ? 'bg-teal group-hover:bg-pop' : 'bg-line')} style={{ height: d[metric] ? `${Math.max((d[metric] / max) * 100, 3)}%` : '2px' }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px] text-xs text-muted">
        {daily.map((d, i) => (
          <span key={d.date} className="min-w-0 flex-1 text-center whitespace-nowrap">
            {i % step === 0 ? label(d.date) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Reportes: kilos procesados, órdenes por estado, tiempos de entrega e ingresos por servicio. */
export function ReportsPage() {
  const { hasFeature } = useAccess()
  const { branches } = useBranch()
  const today = todayLocal()
  const [preset, setPreset] = useState<Preset>('30')
  const [custom, setCustom] = useState({ from: addDaysYmd(today, -29), to: today })
  const [branchId, setBranchId] = useState('')
  const [metric, setMetric] = useState<Metric>('orders')
  const byBranch = hasFeature('branch_reports')

  const range = preset === 'custom' ? custom : preset === 'month' ? { from: `${today.slice(0, 7)}-01`, to: today } : { from: addDaysYmd(today, -(Number(preset) - 1)), to: today }
  const valid = range.from <= range.to
  const report = useQuery({
    queryKey: ['reports', range.from, range.to, branchId],
    queryFn: () => api<Overview>(`/reports/overview?from=${range.from}&to=${range.to}${branchId ? `&branchId=${branchId}` : ''}`),
    placeholderData: keepPreviousData,
    enabled: valid,
  })
  const r = report.data
  const s = r?.summary
  const maxStatus = s ? Math.max(...STATUSES.map((st) => s.byStatus[st]), 1) : 1

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips<Preset>
          aria-label="Periodo"
          value={preset}
          onValueChange={setPreset}
          options={[
            { value: '7', label: 'Últimos 7 días' },
            { value: '30', label: 'Últimos 30 días' },
            { value: 'month', label: 'Este mes' },
            { value: 'custom', label: 'Otro periodo' },
          ]}
        />
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="Desde" value={custom.from} max={today} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} className="w-auto" />
            <span className="text-muted">a</span>
            <Input type="date" aria-label="Hasta" value={custom.to} max={today} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} className="w-auto" />
          </div>
        )}
        {byBranch && branches.length > 1 && (
          <Select aria-label="Sucursal" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="ml-auto w-auto">
            <option value="">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {!valid ? (
        <p className="m-0 text-sm font-semibold text-bad">La fecha inicial es posterior a la final.</p>
      ) : report.isLoading ? (
        <Skeleton className="h-[420px] rounded-card" />
      ) : !r || !s ? (
        <p className="m-0 text-sm font-semibold text-bad">{errorMessage(report.error)}</p>
      ) : (
        <div className={cn('flex flex-col gap-4', report.isPlaceholderData && 'opacity-60')} aria-busy={report.isFetching}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Shirt} label="Órdenes" value={String(s.orders)} detail={`${s.expressOrders} express`} />
            <Kpi icon={Scale} label="Kilos procesados" value={`${s.kilos} kg`} detail={s.orders ? `${(s.kilos / r.range.days).toFixed(1)} kg por día` : undefined} />
            <Kpi icon={Receipt} label="Facturado" value={formatCents(s.billed)} detail={`Ticket promedio ${formatCents(s.averageTicket)}`} />
            <Kpi icon={Wallet} label="Cobrado" value={formatCents(s.collected)} detail={s.discounts ? `${formatCents(s.discounts)} en descuentos` : 'En el periodo'} featured />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Órdenes por estado" />
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {STATUSES.map((st) => (
                  <li key={st} className="grid grid-cols-[110px_minmax(0,1fr)_44px] items-center gap-3">
                    <span className="text-body">{STATUS_META[st].label}</span>
                    <Bar value={s.byStatus[st]} max={maxStatus} className={STATUS_BAR[st]} />
                    <span className="tabular text-right font-semibold">{s.byStatus[st]}</span>
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-3 text-sm text-muted">Órdenes recibidas en el periodo, según su estado de hoy.</p>
            </Card>

            <Card>
              <CardHeader title="Tiempos de entrega" />
              {r.times ? (
                r.times.readyOrders === 0 ? (
                  <p className="m-0 py-3 text-sm text-muted">Ninguna orden quedó lista en este periodo.</p>
                ) : (
                  <dl className="m-0 flex flex-col gap-4">
                    <div className="flex items-center gap-3.5">
                      <span className="grid size-11 flex-none place-items-center rounded-tile bg-teal-soft text-teal-ink">
                        <Timer size={20} aria-hidden />
                      </span>
                      <div className="flex-1">
                        <dt className="text-sm text-muted">De recibida a lista</dt>
                        <dd className="tabular m-0 text-xl font-bold">{duration(r.times.hoursToReady)}</dd>
                      </div>
                    </div>
                    <div className="flex items-center gap-3.5">
                      <span className={cn('grid size-11 flex-none place-items-center rounded-tile', (r.times.onTimePercent ?? 0) >= 90 ? 'bg-ok-bg text-ok' : 'bg-pop-soft text-pop-ink')}>
                        <Clock size={20} aria-hidden />
                      </span>
                      <div className="flex-1">
                        <dt className="text-sm text-muted">Listas a la hora prometida</dt>
                        <dd className="tabular m-0 text-xl font-bold">{r.times.onTimePercent} %</dd>
                      </div>
                    </div>
                    <div className="flex items-center gap-3.5">
                      <span className="grid size-11 flex-none place-items-center rounded-tile bg-surface-2 text-ink-2">
                        <Shirt size={20} aria-hidden />
                      </span>
                      <div className="flex-1">
                        <dt className="text-sm text-muted">El cliente tarda en recogerla</dt>
                        <dd className="tabular m-0 text-xl font-bold">{duration(r.times.hoursToPickup)}</dd>
                      </div>
                    </div>
                    <p className="m-0 text-sm text-muted">Sobre {r.times.readyOrders} {r.times.readyOrders === 1 ? 'orden que quedó lista' : 'órdenes que quedaron listas'} en el periodo.</p>
                  </dl>
                )
              ) : (
                <p className="m-0 text-body text-muted">Cuánto demoras en dejar lista una orden y cuánto tarda el cliente en recogerla. Disponible en el plan Pro.</p>
              )}
            </Card>
          </div>

          {r.daily && (
            <Card>
              <CardHeader
                title="Día a día"
                actions={
                  <Segmented<Metric>
                    aria-label="Qué mostrar"
                    value={metric}
                    onValueChange={setMetric}
                    options={[
                      { value: 'orders', label: 'Órdenes' },
                      { value: 'kilos', label: 'Kilos' },
                      { value: 'collected', label: 'Cobrado' },
                    ]}
                  />
                }
              />
              <DailyChart daily={r.daily} metric={metric} />
            </Card>
          )}

          {r.services && (
            <Card>
              <CardHeader title="Ingresos por servicio" />
              {r.services.length === 0 ? (
                <p className="m-0 py-3 text-sm text-muted">Sin órdenes en este periodo.</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Servicio</Th>
                      <Th className="text-right">Cantidad</Th>
                      <Th className="hidden text-right sm:table-cell">Órdenes</Th>
                      <Th className="hidden w-[30%] md:table-cell">Participación</Th>
                      <Th className="text-right">Ingresos</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.services.map((sv) => (
                      <tr key={sv.serviceId}>
                        <Td className="whitespace-normal">
                          <span className="font-semibold">{sv.name}</span>
                          {sv.category && <span className="block text-xs text-muted">{sv.category}</span>}
                        </Td>
                        <Td className="text-right">
                          {sv.quantity} {sv.quantity === 1 ? UNIT_META[sv.unit].one : UNIT_META[sv.unit].many}
                        </Td>
                        <Td className="hidden text-right sm:table-cell">{sv.orders}</Td>
                        <Td className="hidden md:table-cell">
                          <span className="flex items-center gap-2.5">
                            <Bar value={sv.share} max={100} />
                            <span className="w-10 text-right text-sm text-muted">{sv.share} %</span>
                          </span>
                        </Td>
                        <Td className="text-right font-semibold">{formatCents(sv.income)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {r.methods && (
              <Card>
                <CardHeader title="Cobrado por medio de pago" />
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {r.methods
                    .filter((m) => m.amount > 0 || m.method === 'cash' || m.method === 'yape' || m.method === 'plin')
                    .map((m) => (
                      <li key={m.method} className="grid grid-cols-[120px_minmax(0,1fr)_110px] items-center gap-3">
                        <span className="text-body">{METHOD_LABELS[m.method]}</span>
                        <Bar value={m.amount} max={Math.max(s.collected, 1)} />
                        <span className="tabular text-right font-semibold">{formatCents(m.amount)}</span>
                      </li>
                    ))}
                </ul>
              </Card>
            )}
            {r.branches && (
              <Card>
                <CardHeader title="Por sucursal" />
                <Table>
                  <thead>
                    <tr>
                      <Th>Sucursal</Th>
                      <Th className="text-right">Órdenes</Th>
                      <Th className="text-right">Facturado</Th>
                      <Th className="text-right">Cobrado</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.branches.map((b) => (
                      <tr key={b.branchId}>
                        <Td className="font-semibold">{b.name}</Td>
                        <Td className="text-right">{b.orders}</Td>
                        <Td className="text-right">{formatCents(b.billed)}</Td>
                        <Td className="text-right font-semibold">{formatCents(b.collected)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            )}
          </div>

          {!r.features.advanced && (
            <Card>
              <Upsell />
            </Card>
          )}
        </div>
      )}
    </>
  )
}

function Upsell() {
  const { can } = useAccess()
  return (
    <p className="m-0 rounded-tile bg-teal-soft px-4 py-3 text-body text-teal-ink">
      Los tiempos de entrega, el día a día, los ingresos por servicio y por medio de pago están en el plan <b className="font-bold">Pro</b>.{' '}
      {can('subscription.manage') && (
        <Link to="/configuracion?tab=plan" className="font-semibold underline underline-offset-2">
          Ver planes
        </Link>
      )}
    </p>
  )
}
