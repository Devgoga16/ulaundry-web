import { useInfiniteQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FilterChips } from '@/components/ui/controls'
import { EmptyState, Skeleton } from '@/components/ui/display'
import { formatWhen, METHOD_LABELS, type PaymentMethod } from '@/features/orders/api'
import { api, errorMessage } from '@/lib/api/client'
import { formatCents } from '@/lib/format'

interface AuditLog {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown>
  actorName: string
  createdAt: string
}

type Group = 'all' | 'order' | 'money' | 'team' | 'settings' | 'support'
const PAGE = 50

const LABELS: Record<string, string> = {
  'organization.created': 'Creó el negocio',
  'organization.updated': 'Cambió los datos del negocio',
  'organization.logo_updated': 'Cambió el logo',
  'organization.logo_removed': 'Quitó el logo',
  'organization.suspended': 'El negocio fue suspendido',
  'organization.reactivated': 'El negocio fue reactivado',
  'order_settings.updated': 'Cambió las reglas de órdenes',
  'branch.created': 'Creó una sucursal',
  'branch.updated': 'Editó una sucursal',
  'branch.hours_updated': 'Cambió el horario de una sucursal',
  'service.created': 'Creó un servicio',
  'service.updated': 'Editó un servicio',
  'promotion.created': 'Creó una promoción',
  'promotion.updated': 'Editó una promoción',
  'client.created': 'Registró un cliente',
  'client.updated': 'Editó un cliente',
  'order.created': 'Registró una orden',
  'order.updated': 'Editó una orden',
  'order.status_changed': 'Cambió el estado de una orden',
  'order.delivered': 'Entregó una orden',
  'order.cancelled': 'Anuló una orden',
  'order.pickup_done': 'Marcó un recojo a domicilio',
  'order.pickup_requested': 'Un cliente pidió un recojo desde el portal',
  'payment.created': 'Registró un cobro',
  'payment.voided': 'Anuló un pago',
  'cash.movement_created': 'Registró un movimiento de caja',
  'cash.movement_deleted': 'Eliminó un movimiento de caja',
  'cash.closed': 'Cerró la caja',
  'cash.reopened': 'Reabrió la caja',
  'invitation.created': 'Invitó a una persona',
  'invitation.resent': 'Reenvió una invitación',
  'invitation.revoked': 'Canceló una invitación',
  'invitation.accepted': 'Aceptó su invitación',
  'member.updated': 'Cambió el acceso de un miembro',
  'role.created': 'Creó un rol',
  'role.updated': 'Editó un rol',
  'role.deleted': 'Eliminó un rol',
  'support.view_started': 'Soporte de uLaundry entró en modo solo lectura',
  'auth.login': 'Inició sesión',
  'auth.login_failed': 'Intento de ingreso fallido',
  'billing.payment_reported': 'Reportó un pago de suscripción',
  'billing.payment_approved': 'uLaundry aprobó el pago de la suscripción',
  'billing.payment_rejected': 'uLaundry rechazó el pago de la suscripción',
  'platform.organization_updated': 'uLaundry cambió datos del negocio',
  'platform.owner_updated': 'uLaundry cambió datos del dueño',
  'platform.subscription_updated': 'uLaundry cambió la suscripción',
  'support.ticket_created': 'Abrió un ticket de soporte',
  'support.ticket_updated': 'Actualizó un ticket de soporte',
}

const STATUS: Record<string, string> = { received: 'recibida', in_process: 'en proceso', ready: 'lista', delivered: 'entregada', cancelled: 'anulada' }

function groupOf(action: string): Group {
  if (action.startsWith('order.')) return 'order'
  if (action.startsWith('payment.') || action.startsWith('cash.') || action.startsWith('billing.')) return 'money'
  if (action.startsWith('invitation.') || action.startsWith('member.') || action.startsWith('role.') || action.startsWith('auth.')) return 'team'
  if (action.startsWith('support.') || action.startsWith('platform.')) return 'support'
  return 'settings'
}

/** Lo relevante del detalle, en palabras. */
function detail(log: AuditLog): string {
  const m = log.metadata
  const parts: string[] = []
  if (typeof m.ticket === 'string') parts.push(m.ticket)
  if (typeof m.name === 'string') parts.push(m.name)
  if (typeof m.email === 'string') parts.push(m.email)
  if (typeof m.status === 'string' && STATUS[m.status]) parts.push(`a ${STATUS[m.status]}`)
  if (typeof m.amount === 'number') parts.push(formatCents(m.amount))
  if (typeof m.method === 'string') parts.push(METHOD_LABELS[m.method as PaymentMethod]?.toLowerCase() ?? m.method)
  if (typeof m.total === 'number') parts.push(`total ${formatCents(m.total)}`)
  if (typeof m.countedCash === 'number' && typeof m.expectedCash === 'number') parts.push(`contó ${formatCents(m.countedCash)} de ${formatCents(m.expectedCash)}`)
  if (typeof m.balance === 'number' && m.balance > 0) parts.push(`con saldo de ${formatCents(m.balance)}`)
  if (typeof m.reason === 'string') parts.push(`"${m.reason}"`)
  if (typeof m.concept === 'string') parts.push(m.concept)
  return parts.join(' · ')
}

function linkFor(log: AuditLog): string | null {
  if (!log.entityId) return null
  if (log.entityType === 'Order') return `/ordenes/${log.entityId}`
  if (log.entityType === 'Client') return `/clientes/${log.entityId}`
  if (log.entityType === 'Service') return `/servicios/${log.entityId}`
  if (log.entityType === 'Promotion') return `/promociones/${log.entityId}`
  if (log.action.startsWith('payment.') && typeof log.metadata.orderId === 'string') return `/ordenes/${log.metadata.orderId}`
  return null
}

/** Auditoría: quién hizo qué y cuándo. No se puede editar ni borrar. */
export function AuditPage() {
  const [group, setGroup] = useState<Group>('all')
  const logs = useInfiniteQuery({
    queryKey: ['audit-logs'],
    queryFn: ({ pageParam }) => api<AuditLog[]>(`/audit-logs?limit=${PAGE}${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1]!.createdAt : undefined),
  })
  const all = logs.data?.pages.flat() ?? []
  const shown = all.filter((l) => group === 'all' || groupOf(l.action) === group)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips<Group>
          aria-label="Tipo de acción"
          value={group}
          onValueChange={setGroup}
          options={[
            { value: 'all', label: 'Todo' },
            { value: 'order', label: 'Órdenes' },
            { value: 'money', label: 'Cobros y caja' },
            { value: 'team', label: 'Equipo' },
            { value: 'settings', label: 'Configuración' },
            { value: 'support', label: 'Soporte' },
          ]}
        />
        <p className="m-0 text-sm text-muted">El registro no se puede editar ni borrar.</p>
      </div>

      {logs.isLoading ? (
        <Skeleton className="h-[320px] rounded-card" />
      ) : logs.isError ? (
        <p className="m-0 text-sm font-semibold text-bad">{errorMessage(logs.error)}</p>
      ) : (
        <Card>
          {shown.length === 0 ? (
            <EmptyState icon={History} title="Sin acciones en este filtro" description={logs.hasNextPage ? 'Carga más registros para seguir buscando hacia atrás.' : undefined} />
          ) : (
            <ol className="m-0 list-none p-0">
              {shown.map((log) => {
                const to = linkFor(log)
                const text = detail(log)
                return (
                  <li key={log.id} className="grid gap-x-4 gap-y-0.5 border-t border-line py-3 first:border-t-0 sm:grid-cols-[170px_minmax(0,1fr)]">
                    <span className="text-sm text-muted">{formatWhen(log.createdAt)}</span>
                    <span>
                      <span className="font-semibold">{log.actorName}</span> · {LABELS[log.action] ?? log.action}
                      {(text || to) && (
                        <span className="block text-sm text-ink-2">
                          {text}
                          {to && (
                            <>
                              {text && ' · '}
                              <Link to={to} className="font-semibold text-brand hover:underline">
                                Ver
                              </Link>
                            </>
                          )}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
          {logs.hasNextPage && (
            <div className="mt-3 flex justify-center border-t border-line pt-3.5">
              <Button onClick={() => void logs.fetchNextPage()} disabled={logs.isFetchingNextPage}>
                {logs.isFetchingNextPage ? 'Cargando…' : 'Cargar más antiguos'}
              </Button>
            </div>
          )}
        </Card>
      )}
    </>
  )
}
