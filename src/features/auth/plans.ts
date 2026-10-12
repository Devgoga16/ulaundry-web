import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { FeatureKey, FeatureValue, Plan } from '@/lib/api/types'

function limitText(value: FeatureValue, one: string, many: (n: number) => string, unlimited: string) {
  if (value === null) return unlimited
  return value === 1 ? one : many(Number(value))
}

/** Funcionalidades que diferencian a los planes, en orden de importancia. */
const HIGHLIGHTS: Array<[FeatureKey, string]> = [
  ['whatsapp', 'Avisos por WhatsApp'],
  ['printable_ticket', 'Ticket imprimible'],
  ['cash_register', 'Caja del día'],
  ['order_photos', 'Fotos de manchas y daños'],
  ['home_delivery', 'Recojo y entrega a domicilio'],
  ['client_portal', 'Portal del cliente'],
  ['pickup_reminders', 'Recordatorios de órdenes sin recoger'],
  ['promotions', 'Promociones y descuentos'],
  ['custom_roles', 'Roles personalizados'],
  ['advanced_reports', 'Reportes completos'],
  ['branch_reports', 'Reportes por sucursal'],
  ['audit_log', 'Registro de auditoría'],
  ['white_label', 'Sin marca uLaundry'],
]

export function planHighlights(plan: Plan): string[] {
  const f = plan.features
  return [
    limitText(f.max_branches, '1 sucursal', (n) => `Hasta ${n} sucursales`, 'Sucursales ilimitadas'),
    limitText(f.max_members, '1 usuario', (n) => `Hasta ${n} usuarios`, 'Usuarios ilimitados'),
    limitText(f.max_orders_per_month, '1 orden al mes', (n) => `${n} órdenes al mes`, 'Órdenes ilimitadas'),
    ...HIGHLIGHTS.filter(([key]) => f[key] === true).map(([, label]) => label),
  ]
}

export const plansQueryKey = ['plans'] as const

export function usePlans() {
  return useQuery({ queryKey: plansQueryKey, queryFn: () => api<Plan[]>('/plans'), staleTime: 5 * 60_000 })
}

const whole = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 })

/** Precio de un plan: 5900 (céntimos) → "S/ 59". */
export function formatPlanPrice(cents: number, currency = 'PEN'): string {
  return `${currency === 'USD' ? 'US$' : 'S/'} ${whole.format(cents / 100)}`
}
