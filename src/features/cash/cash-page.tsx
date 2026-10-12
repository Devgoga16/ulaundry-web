import { ArrowDownLeft, ArrowUpRight, Banknote, ChevronLeft, ChevronRight, Lock, LockOpen, Smartphone, Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button, IconButton } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/controls'
import { Skeleton, Table, Td, Th } from '@/components/ui/display'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Kpi } from '@/components/ui/kpi'
import { METHOD_LABELS, METHODS, formatWhen, useCashActions, useCashDay, type CashDay } from '@/features/orders/api'
import { errorMessage } from '@/lib/api/client'
import { useAccess } from '@/lib/auth/access'
import { useBranch } from '@/lib/auth/branch-context'
import { cn } from '@/lib/cn'
import { formatCents, parseSoles } from '@/lib/format'
import { addDaysYmd, formatLongDate, todayLocal } from '@/lib/time'

function MoneyField({ value, onChange, ...p }: { value: string; onChange: (v: string) => void; id: string; 'aria-invalid'?: boolean; autoFocus?: boolean }) {
  return (
    <div className="flex">
      <span className="grid place-items-center rounded-l-control border border-r-0 border-line-strong bg-surface-2 px-3 text-body text-muted">S/</span>
      <Input {...p} value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="0.00" className="rounded-l-none text-md font-semibold" />
    </div>
  )
}

/** Ingreso o egreso de efectivo que no viene de una orden. */
function MovementForm({ branchId }: { branchId: string }) {
  const { addMovement } = useCashActions()
  const [type, setType] = useState<'in' | 'out'>('out')
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const cents = parseSoles(amount)
    if (cents === null || cents <= 0) return setError('Ingresa un monto válido')
    if (concept.trim().length < 2) return setError('Escribe el concepto')
    try {
      await addMovement.mutateAsync({ branchId, type, amount: cents, concept: concept.trim() })
      setAmount('')
      setConcept('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3 rounded-tile bg-surface-2 p-4">
      <Segmented<'in' | 'out'>
        aria-label="Tipo de movimiento"
        value={type}
        onValueChange={setType}
        options={[
          { value: 'out', label: 'Salida de efectivo' },
          { value: 'in', label: 'Ingreso de efectivo' },
        ]}
        className="self-start"
      />
      <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-end">
        <Field label="Monto">{(p) => <MoneyField {...p} value={amount} onChange={setAmount} />}</Field>
        <Field label="Concepto">
          {(p) => <Input {...p} value={concept} onChange={(e) => setConcept(e.target.value)} placeholder={type === 'out' ? 'Detergente, pasaje, almuerzo…' : 'Sencillo inicial, reposición…'} maxLength={120} />}
        </Field>
        <Button type="submit" variant="primary" disabled={addMovement.isPending}>
          {addMovement.isPending ? 'Guardando…' : 'Registrar'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold text-bad">
          {error}
        </p>
      )}
    </form>
  )
}

/** Cierre: se cuenta el efectivo y se compara con lo que debía haber. */
function CloseForm({ day }: { day: CashDay }) {
  const { close } = useCashActions()
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const cents = parseSoles(counted)
  const diff = cents === null ? null : cents - day.expectedCash

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (cents === null) return setError('Ingresa cuánto efectivo contaste')
    try {
      await close.mutateAsync({ branchId: day.branchId, countedCash: cents, ...(notes.trim() && { notes: notes.trim() }) })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
      <p className="m-0 text-sm text-muted">
        Cuenta los billetes y monedas de la caja. Según lo registrado debería haber <b className="font-semibold text-ink">{formatCents(day.expectedCash)}</b>.
      </p>
      <div className="grid gap-3.5 sm:grid-cols-[200px_minmax(0,1fr)]">
        <Field label="Efectivo contado">{(p) => <MoneyField {...p} value={counted} onChange={setCounted} />}</Field>
        <Field label="Nota (opcional)">{(p) => <Textarea {...p} rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Faltó un sol de vuelto…" maxLength={300} />}</Field>
      </div>
      {diff !== null && (
        <p className={cn('m-0 rounded-control px-3 py-2 text-sm font-semibold', diff === 0 ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn')}>
          {diff === 0 ? 'Cuadra exacto.' : diff > 0 ? `Sobran ${formatCents(diff)}.` : `Faltan ${formatCents(-diff)}.`}
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold text-bad">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" className="self-start" disabled={close.isPending}>
        <Lock size={16} aria-hidden /> {close.isPending ? 'Cerrando…' : 'Cerrar la caja de hoy'}
      </Button>
    </form>
  )
}

/** Caja del día: lo cobrado por medio de pago, el efectivo que entra y sale, y el cierre. */
export function CashPage() {
  const { can, readOnly } = useAccess()
  const { current } = useBranch()
  const today = todayLocal()
  const [date, setDate] = useState(today)
  const cash = useCashDay(current?.id, date)
  const { removeMovement, reopen } = useCashActions()
  const [error, setError] = useState<string | null>(null)
  const canManage = can('cash.manage') && !readOnly
  const isToday = date === today
  const day = cash.data
  const editable = canManage && isToday && !!day && !day.close
  const digital = day ? day.totals.yape.amount + day.totals.plin.amount : 0
  const others = day ? day.totals.transfer.amount + day.totals.card.amount + day.totals.other.amount : 0

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-semibold tracking-[.08em] text-muted uppercase">{current?.name}</p>
          <h2 className="m-0 mt-0.5 text-2xl font-bold tracking-[-.01em]">{isToday ? `Hoy, ${formatLongDate(date).toLowerCase()}` : formatLongDate(date)}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <IconButton aria-label="Día anterior" className="size-10 border border-line-strong" onClick={() => setDate(addDaysYmd(date, -1))}>
            <ChevronLeft size={18} aria-hidden />
          </IconButton>
          <Input type="date" aria-label="Fecha" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-auto" />
          <IconButton aria-label="Día siguiente" className="size-10 border border-line-strong disabled:opacity-40" disabled={isToday} onClick={() => setDate(addDaysYmd(date, 1))}>
            <ChevronRight size={18} aria-hidden />
          </IconButton>
          {!isToday && <Button onClick={() => setDate(today)}>Hoy</Button>}
        </div>
      </div>

      {cash.isLoading ? (
        <Skeleton className="h-[360px] rounded-card" />
      ) : !day ? (
        <p className="m-0 text-sm font-semibold text-bad">{errorMessage(cash.error)}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Wallet} label="Cobrado en el día" value={formatCents(day.collected)} detail={`${day.payments.filter((p) => p.status === 'valid').length} cobros`} featured />
            <Kpi icon={Banknote} label="Efectivo" value={formatCents(day.totals.cash.amount)} detail={`${day.totals.cash.count} cobros`} />
            <Kpi icon={Smartphone} label="Yape y Plin" value={formatCents(digital)} detail={`Yape ${formatCents(day.totals.yape.amount)} · Plin ${formatCents(day.totals.plin.amount)}`} />
            <Kpi icon={Wallet} label="Transferencia, tarjeta y otros" value={formatCents(others)} />
          </div>

          {error && (
            <p role="alert" className="m-0 rounded-control bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">
              {error}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Card className="flex flex-col gap-4">
              <CardHeader title="Efectivo en caja" className="mb-0" />
              <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-body">
                <dt className="text-muted">Cobros en efectivo</dt>
                <dd className="tabular m-0 text-right">{formatCents(day.totals.cash.amount)}</dd>
                <dt className="text-muted">Ingresos de efectivo</dt>
                <dd className="tabular m-0 text-right">+ {formatCents(day.cashIn)}</dd>
                <dt className="text-muted">Salidas de efectivo</dt>
                <dd className="tabular m-0 text-right">− {formatCents(day.cashOut)}</dd>
                <dt className="mt-1 border-t border-line pt-2 text-md font-bold">Debe haber en caja</dt>
                <dd className="tabular m-0 mt-1 border-t border-line pt-2 text-right text-xl font-bold">{formatCents(day.expectedCash)}</dd>
              </dl>

              {day.movements.length > 0 && (
                <ul className="m-0 list-none p-0">
                  {day.movements.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 border-t border-line py-2.5">
                      <span className={cn('grid size-9 flex-none place-items-center rounded-tile', m.type === 'in' ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn')}>
                        {m.type === 'in' ? <ArrowDownLeft size={17} aria-hidden /> : <ArrowUpRight size={17} aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{m.concept}</span>
                        <span className="block text-xs text-muted">
                          {formatWhen(m.createdAt)} · {m.createdByName}
                        </span>
                      </span>
                      <span className="tabular font-semibold">
                        {m.type === 'in' ? '+' : '−'} {formatCents(m.amount)}
                      </span>
                      {editable && (
                        <IconButton aria-label={`Eliminar ${m.concept}`} disabled={removeMovement.isPending} onClick={() => void run(() => removeMovement.mutateAsync(m.id))}>
                          <Trash2 size={16} aria-hidden />
                        </IconButton>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {editable && current && <MovementForm branchId={current.id} />}
            </Card>

            <Card>
              <CardHeader title="Cierre de caja" />
              {day.close ? (
                <div className="flex flex-col gap-3.5">
                  <p className={cn('m-0 rounded-tile px-4 py-3 text-body font-semibold', day.close.difference === 0 ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn')}>
                    {day.close.difference === 0 ? 'Caja cerrada: cuadró exacto.' : day.close.difference > 0 ? `Caja cerrada: sobraron ${formatCents(day.close.difference)}.` : `Caja cerrada: faltaron ${formatCents(-day.close.difference)}.`}
                  </p>
                  <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-body">
                    <dt className="text-muted">Debía haber</dt>
                    <dd className="tabular m-0 text-right">{formatCents(day.close.expectedCash)}</dd>
                    <dt className="text-muted">Se contó</dt>
                    <dd className="tabular m-0 text-right font-semibold">{formatCents(day.close.countedCash)}</dd>
                  </dl>
                  {day.close.notes && <p className="m-0 text-sm text-ink-2">{day.close.notes}</p>}
                  <p className="m-0 text-xs text-muted">
                    Cerró {day.close.closedByName} · {formatWhen(day.close.closedAt)}
                  </p>
                  {canManage && isToday && (
                    <Button className="self-start" disabled={reopen.isPending} onClick={() => void run(() => reopen.mutateAsync(day.branchId))}>
                      <LockOpen size={16} aria-hidden /> Reabrir la caja
                    </Button>
                  )}
                </div>
              ) : editable ? (
                <CloseForm key={day.expectedCash} day={day} />
              ) : (
                <p className="m-0 text-sm text-muted">{isToday ? 'La caja de hoy sigue abierta.' : 'Este día no se cerró la caja.'}</p>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader title="Cobros del día" />
            {day.payments.length === 0 ? (
              <p className="m-0 py-4 text-center text-sm text-muted">No se registraron cobros este día.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Hora</Th>
                    <Th>Orden</Th>
                    <Th className="hidden sm:table-cell">Cliente</Th>
                    <Th>Medio</Th>
                    <Th className="hidden md:table-cell">Cobró</Th>
                    <Th className="text-right">Monto</Th>
                  </tr>
                </thead>
                <tbody>
                  {day.payments.map((p) => (
                    <tr key={p.id} className={cn(p.status === 'voided' && 'opacity-55')}>
                      <Td className="text-muted">{formatWhen(p.createdAt).replace(/^Hoy /, '')}</Td>
                      <Td>
                        <Link to={`/ordenes/${p.orderId}`} className="font-bold text-ink hover:underline">
                          {p.orderTicket}
                        </Link>
                      </Td>
                      <Td className="hidden whitespace-normal sm:table-cell">{p.clientName}</Td>
                      <Td>
                        {METHOD_LABELS[p.method]}
                        {p.reference && <span className="block text-xs text-muted">{p.reference}</span>}
                        {p.status === 'voided' && <span className="block text-xs font-semibold text-bad">Anulado</span>}
                      </Td>
                      <Td className="hidden md:table-cell">{p.receivedByName}</Td>
                      <Td className={cn('text-right font-semibold', p.status === 'voided' && 'line-through')}>{formatCents(p.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <Td colSpan={5} className="text-right font-semibold text-muted">
                      {METHODS.filter((m) => day.totals[m].amount > 0)
                        .map((m) => `${METHOD_LABELS[m]} ${formatCents(day.totals[m].amount)}`)
                        .join(' · ')}
                    </Td>
                    <Td className="text-right text-md font-bold">{formatCents(day.collected)}</Td>
                  </tr>
                </tfoot>
              </Table>
            )}
          </Card>
        </>
      )}
    </>
  )
}
