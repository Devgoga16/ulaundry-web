import { useQuery } from '@tanstack/react-query'
import { Banknote, ChevronLeft, ChevronRight, Image, Receipt, Smartphone, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox, Segmented } from '@/components/ui/controls'
import { EmptyState, Skeleton, Table, Td, Th } from '@/components/ui/display'
import { Field, Input, Select } from '@/components/ui/field'
import { Kpi } from '@/components/ui/kpi'
import { Modal } from '@/components/ui/overlays'
import { ProofImage } from '@/components/ui/proof-image'
import { METHOD_LABELS, METHODS, formatWhen, type PaymentMethod, type PaymentView } from '@/features/orders/api'
import { api, errorMessage } from '@/lib/api/client'
import { useAccess } from '@/lib/auth/access'
import { useBranch } from '@/lib/auth/branch-context'
import { cn } from '@/lib/cn'
import { formatCents } from '@/lib/format'
import { addDaysYmd, todayLocal } from '@/lib/time'

interface PaymentsPage {
  items: PaymentView[]
  total: number
  page: number
  pageSize: number
  totals: Record<PaymentMethod, { amount: number; count: number }>
}

const RANGES = ['hoy', '7d', '30d', 'mes', 'otro'] as const
type Range = (typeof RANGES)[number]

function rangeDates(range: Range, from: string, to: string): { from: string; to: string } {
  const today = todayLocal()
  if (range === 'hoy') return { from: today, to: today }
  if (range === '7d') return { from: addDaysYmd(today, -6), to: today }
  if (range === '30d') return { from: addDaysYmd(today, -29), to: today }
  if (range === 'mes') return { from: `${today.slice(0, 7)}-01`, to: today }
  return { from, to }
}

/** Historial de cobros del negocio: por fechas, medio de pago y sucursal. */
export function PaymentsPage() {
  const { current, branches } = useBranch()
  const { can } = useAccess()
  const [params, setParams] = useSearchParams()
  const range = (RANGES as readonly string[]).includes(params.get('periodo') ?? '') ? (params.get('periodo') as Range) : '7d'
  const method = (METHODS as string[]).includes(params.get('medio') ?? '') ? (params.get('medio') as PaymentMethod) : ''
  const includeVoided = params.get('anulados') === '1'
  const page = Math.max(1, Number(params.get('pagina')) || 1)
  const today = todayLocal()
  const dates = rangeDates(range, params.get('desde') || addDaysYmd(today, -6), params.get('hasta') || today)
  const [proof, setProof] = useState<PaymentView | null>(null)

  /** Cambia filtros en la URL; cualquier cambio vuelve a la primera página. */
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    next.delete('pagina')
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const validRange = dates.from <= dates.to
  const q = useQuery({
    queryKey: ['payments', 'list', current?.id, dates.from, dates.to, method, includeVoided, page],
    queryFn: () => {
      const p = new URLSearchParams({ from: dates.from, to: dates.to, page: String(page) })
      if (current) p.set('branchId', current.id)
      if (method) p.set('method', method)
      if (includeVoided) p.set('includeVoided', 'true')
      return api<PaymentsPage>(`/payments?${p.toString()}`)
    },
    enabled: validRange,
    placeholderData: (prev) => prev,
  })
  const data = q.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const collected = data ? METHODS.reduce((sum, m) => sum + data.totals[m].amount, 0) : 0
  const count = data ? METHODS.reduce((sum, m) => sum + data.totals[m].count, 0) : 0
  const wallets = data ? data.totals.yape.amount + data.totals.plin.amount : 0
  const others = data ? collected - data.totals.cash.amount - wallets : 0
  const otherCount = data ? count - data.totals.cash.count - data.totals.yape.count - data.totals.plin.count : 0

  return (
    <>
      <p className="m-0 text-body text-muted">
        Todo lo cobrado{branches.length > 1 && current ? ` en ${current.name}` : ''}, orden por orden. Para cuadrar el efectivo de un día usa{' '}
        {can('cash.manage') ? (
          <Link to="/caja" className="font-semibold text-brand hover:underline">
            Caja del día
          </Link>
        ) : (
          'Caja del día'
        )}
        .
      </p>

      <Card className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-end gap-3">
          <Segmented
            aria-label="Periodo"
            value={range}
            onValueChange={(v) => set({ periodo: v === '7d' ? null : v, desde: null, hasta: null })}
            options={[
              { value: 'hoy', label: 'Hoy' },
              { value: '7d', label: '7 días' },
              { value: '30d', label: '30 días' },
              { value: 'mes', label: 'Este mes' },
              { value: 'otro', label: 'Otro periodo' },
            ]}
          />
          <Field label="Medio de pago" className="w-[190px]">
            {(p) => (
              <Select {...p} value={method} onChange={(e) => set({ medio: e.target.value })}>
                <option value="">Todos</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-body">
            <Checkbox checked={includeVoided} onCheckedChange={(v) => set({ anulados: v === true ? '1' : null })} />
            Mostrar anulados
          </label>
        </div>
        {range === 'otro' && (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Desde" className="w-[170px]">
              {(p) => <Input {...p} type="date" value={dates.from} max={today} onChange={(e) => e.target.value && set({ periodo: 'otro', desde: e.target.value, hasta: dates.to })} />}
            </Field>
            <Field label="Hasta" className="w-[170px]">
              {(p) => <Input {...p} type="date" value={dates.to} max={today} onChange={(e) => e.target.value && set({ periodo: 'otro', desde: dates.from, hasta: e.target.value })} />}
            </Field>
            {!validRange && <p className="m-0 pb-2.5 text-sm font-semibold text-bad">La fecha "desde" debe ser anterior a "hasta".</p>}
          </div>
        )}
      </Card>

      {q.isError ? (
        <Card>
          <p role="alert" className="m-0 text-body font-semibold text-bad">
            {errorMessage(q.error)}
          </p>
        </Card>
      ) : !data ? (
        <Skeleton className="h-[360px] rounded-card" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Wallet} label="Cobrado en el periodo" value={formatCents(collected)} detail={`${count} ${count === 1 ? 'cobro' : 'cobros'}`} featured />
            <Kpi icon={Banknote} label="Efectivo" value={formatCents(data.totals.cash.amount)} detail={`${data.totals.cash.count} ${data.totals.cash.count === 1 ? 'cobro' : 'cobros'}`} />
            <Kpi icon={Smartphone} label="Yape y Plin" value={formatCents(wallets)} detail={`Yape ${formatCents(data.totals.yape.amount)} · Plin ${formatCents(data.totals.plin.amount)}`} />
            <Kpi icon={Receipt} label="Transferencia, tarjeta y otros" value={formatCents(others)} detail={`${otherCount} ${otherCount === 1 ? 'cobro' : 'cobros'}`} />
          </div>

          <Card className={cn(q.isPlaceholderData && 'opacity-70')}>
            {data.items.length === 0 ? (
              <EmptyState icon={Receipt} title="Sin cobros en este periodo" description="Cambia las fechas o el medio de pago para ver otros cobros." />
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Fecha</Th>
                      <Th>Orden</Th>
                      <Th className="hidden sm:table-cell">Cliente</Th>
                      <Th>Medio</Th>
                      <Th className="hidden md:table-cell">Cobró</Th>
                      <Th className="text-right">Monto</Th>
                      <Th className="w-0" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((p) => (
                      <tr key={p.id} className={cn(p.status === 'voided' && 'opacity-60')}>
                        <Td className="text-muted">{formatWhen(p.createdAt)}</Td>
                        <Td>
                          <Link to={`/ordenes/${p.orderId}`} className="font-bold text-ink hover:underline">
                            {p.orderTicket}
                          </Link>
                        </Td>
                        <Td className="hidden whitespace-normal sm:table-cell">{p.clientName}</Td>
                        <Td className="whitespace-normal">
                          {METHOD_LABELS[p.method]}
                          {p.reference && <span className="block text-xs text-muted">{p.reference}</span>}
                          {p.status === 'voided' && <span className="block text-xs font-semibold text-bad">Anulado{p.voidReason && `: ${p.voidReason}`}</span>}
                        </Td>
                        <Td className="hidden md:table-cell">{p.receivedByName}</Td>
                        <Td className={cn('tabular text-right font-semibold', p.status === 'voided' && 'line-through')}>{formatCents(p.amount)}</Td>
                        <Td className="text-right">
                          {p.hasProof && (
                            <Button size="sm" variant="ghost" onClick={() => setProof(p)}>
                              <Image size={13} aria-hidden /> Comprobante
                            </Button>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
                  <span>
                    {(data.page - 1) * data.pageSize + 1}–{(data.page - 1) * data.pageSize + data.items.length} de {data.total}
                  </span>
                  {pages > 1 && (
                    <div className="flex items-center gap-1">
                      <IconButton aria-label="Página anterior" disabled={page <= 1} onClick={() => setParams((prev) => (prev.set('pagina', String(page - 1)), prev), { replace: true })}>
                        <ChevronLeft size={18} aria-hidden />
                      </IconButton>
                      <span className="tabular px-1">
                        {page} / {pages}
                      </span>
                      <IconButton aria-label="Página siguiente" disabled={page >= pages} onClick={() => setParams((prev) => (prev.set('pagina', String(page + 1)), prev), { replace: true })}>
                        <ChevronRight size={18} aria-hidden />
                      </IconButton>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>
        </>
      )}

      <Modal open={!!proof} onOpenChange={(v) => !v && setProof(null)} title={proof ? `Comprobante · ${proof.orderTicket}` : 'Comprobante'}>
        {proof && <ProofImage path={`/payments/${proof.id}/proof`} />}
      </Modal>
    </>
  )
}
