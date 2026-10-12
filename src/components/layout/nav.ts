import {
  Building2,
  ChartColumn,
  HandCoins,
  History,
  House,
  Layers,
  LifeBuoy,
  MessagesSquare,
  Receipt,
  Shirt,
  SquarePlus,
  Tag,
  Tags,
  Truck,
  SlidersHorizontal,
  Store,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { User as ApiUser } from '@/lib/api/types'
import type { Requirement } from '@/lib/auth/access'

export type PlatformRole = NonNullable<ApiUser['platformRole']>

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  /** Ruta de navegación mostrada en el encabezado. */
  crumb: string
  /** Pantalla construida. Las demás muestran "Próximamente". */
  ready?: boolean
  /** Solo visible en desarrollo. */
  devOnly?: boolean
  /** Permiso y/o funcionalidad del plan necesarios para verla. */
  requires?: Requirement
  /** Solo para el equipo de plataforma (Unify Tec). */
  platform?: boolean
  /** Dentro de plataforma, solo estos roles (sin definir = todo el equipo). */
  platformRoles?: PlatformRole[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * Menú principal. Cada ítem se muestra solo si el usuario tiene el permiso y
 * su plan incluye la funcionalidad.
 */
export const NAV: NavGroup[] = [
  {
    label: 'Operación',
    items: [
      { path: '/', label: 'Inicio', icon: House, crumb: 'Inicio', ready: true },
      { path: '/ordenes', label: 'Órdenes', icon: Shirt, crumb: 'Órdenes', requires: { permission: 'order.read' }, ready: true },
      { path: '/ordenes/nueva', label: 'Nueva orden', icon: SquarePlus, crumb: 'Órdenes / Nueva', requires: { permission: 'order.create' }, ready: true },
      { path: '/domicilio', label: 'Domicilio', icon: Truck, crumb: 'Domicilio', requires: { permission: 'order.read', feature: 'home_delivery' }, ready: true },
      { path: '/caja', label: 'Caja del día', icon: HandCoins, crumb: 'Caja del día', requires: { permission: 'cash.manage', feature: 'cash_register' }, ready: true },
      { path: '/pagos', label: 'Pagos', icon: Receipt, crumb: 'Pagos', requires: { permission: 'payment.read' }, ready: true },
    ],
  },
  {
    label: 'Clientes',
    items: [
      { path: '/clientes', label: 'Clientes', icon: Users, crumb: 'Clientes', requires: { permission: 'client.read' }, ready: true },
      { path: '/consultas', label: 'Consultas', icon: MessagesSquare, crumb: 'Clientes / Consultas', requires: { permission: 'client.read', feature: 'client_portal' }, ready: true },
    ],
  },
  {
    label: 'Negocio',
    items: [
      { path: '/servicios', label: 'Servicios', icon: Tags, crumb: 'Servicios', requires: { permission: 'service.read' }, ready: true },
      { path: '/promociones', label: 'Promociones', icon: Tag, crumb: 'Promociones', requires: { permission: 'promotion.manage', feature: 'promotions' }, ready: true },
      { path: '/reportes', label: 'Reportes', icon: ChartColumn, crumb: 'Reportes', requires: { permission: 'report.view' }, ready: true },
      { path: '/sucursales', label: 'Sucursales', icon: Store, crumb: 'Negocio / Sucursales', requires: { permission: 'branch.manage' }, ready: true },
      { path: '/equipo', label: 'Equipo', icon: UserCog, crumb: 'Negocio / Equipo', requires: { permission: 'member.read' }, ready: true },
      { path: '/auditoria', label: 'Auditoría', icon: History, crumb: 'Negocio / Auditoría', requires: { permission: 'audit.read', feature: 'audit_log' }, ready: true },
      { path: '/configuracion', label: 'Configuración', icon: SlidersHorizontal, crumb: 'Negocio / Configuración', requires: { permission: 'organization.manage' }, ready: true },
      { path: '/soporte', label: 'Ayuda y soporte', icon: LifeBuoy, crumb: 'Ayuda / Soporte', ready: true },
    ],
  },
  {
    label: 'Plataforma',
    items: [
      { path: '/superadmin', label: 'Negocios', icon: Building2, crumb: 'Unify Tec / Superadmin', platform: true, ready: true },
      { path: '/superadmin/soporte', label: 'Soporte', icon: LifeBuoy, crumb: 'Unify Tec / Soporte', platform: true, ready: true },
      { path: '/superadmin/planes', label: 'Planes', icon: Layers, crumb: 'Unify Tec / Planes', platform: true, platformRoles: ['super_admin'], ready: true },
      { path: '/superadmin/equipo', label: 'Equipo', icon: UsersRound, crumb: 'Unify Tec / Equipo', platform: true, platformRoles: ['super_admin'], ready: true },
    ],
  },
]

export const NAV_ITEMS = NAV.flatMap((g) => g.items).filter((i) => !i.devOnly || import.meta.env.DEV)

/** Menú visible para la sesión actual. */
export function visibleNav(ctx: 'staff' | 'platform', allowed: (req: Requirement) => boolean, platformRole?: PlatformRole | null): NavGroup[] {
  return NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.devOnly) return import.meta.env.DEV
      if (ctx === 'platform') return !!item.platform && allowedForRole(item, platformRole)
      return !item.platform && allowed(item.requires ?? {})
    }),
  })).filter((group) => group.items.length > 0)
}

/** ¿El rol de plataforma puede ver esta pantalla? */
export function allowedForRole(item: NavItem, platformRole?: PlatformRole | null): boolean {
  return !item.platformRoles || (!!platformRole && item.platformRoles.includes(platformRole))
}

/** Ítem exacto o, en rutas hijas (/clientes/123), el padre más cercano. */
export function findNavItem(pathname: string): NavItem | undefined {
  return (
    NAV_ITEMS.find((i) => i.path === pathname) ??
    NAV_ITEMS.filter((i) => i.path !== '/' && pathname.startsWith(`${i.path}/`)).sort(
      (a, b) => b.path.length - a.path.length,
    )[0]
  )
}
