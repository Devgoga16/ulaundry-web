/**
 * Tipos de las respuestas de uLaundry-api que usa el front.
 * Fuente: uLaundry-api/src (auth.service.ts, entitlements.service.ts, schemas).
 */

export type AuthContextType = 'account' | 'staff' | 'platform'
export type Scope = 'own' | 'branch' | 'organization'

export type PermissionKey =
  | 'organization.manage'
  | 'subscription.manage'
  | 'branch.manage'
  | 'audit.read'
  | 'member.read'
  | 'member.manage'
  | 'role.read'
  | 'role.manage'
  | 'service.read'
  | 'service.manage'
  | 'order.read'
  | 'order.create'
  | 'order.update'
  | 'order.process'
  | 'order.deliver'
  | 'order.cancel'
  | 'delivery.manage'
  | 'client.read'
  | 'client.create'
  | 'client.update'
  | 'client.delete'
  | 'payment.read'
  | 'payment.create'
  | 'payment.void'
  | 'cash.manage'
  | 'promotion.manage'
  | 'report.view'

export type FeatureKey =
  | 'max_branches'
  | 'max_members'
  | 'max_orders_per_month'
  | 'whatsapp'
  | 'order_photos'
  | 'printable_ticket'
  | 'cash_register'
  | 'branding'
  | 'pickup_reminders'
  | 'home_delivery'
  | 'client_portal'
  | 'promotions'
  | 'custom_roles'
  | 'advanced_reports'
  | 'branch_reports'
  | 'audit_log'
  | 'white_label'

export type FeatureValue = boolean | number | null

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  platformRole: 'super_admin' | 'support' | null
}

export interface OrganizationSummary {
  organizationId: string
  membershipId: string
  name: string
  slug: string
  roles: string[]
}

export interface Organization {
  id: string
  name: string
  slug: string
  timezone: string
  currency: string
  country: string
  status: 'active' | 'suspended'
  /** Enlace firmado y temporal; `null` sin logo. */
  logoUrl?: string | null
}

export interface Entitlements {
  organizationId: string
  planCode: string
  planName: string
  status: SubscriptionStatus
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  readOnly: boolean
  suspended: boolean
  features: Record<FeatureKey, FeatureValue>
}

export interface StaffAccess {
  membershipId: string
  isOwner: boolean
  branchIds: string[]
  permissions: Partial<Record<PermissionKey, Scope>>
}

export interface Me {
  user: User
  context: {
    ctx: AuthContextType
    organizationId: string | null
    /** Agente de Unify Tec viendo el negocio en solo lectura. */
    supportView?: boolean
  }
  organizations: OrganizationSummary[]
  organization?: Organization
  access?: StaffAccess
  subscription?: Entitlements
}

export interface Branch {
  id: string
  name: string
  timezone: string
  address?: string
  phone?: string
  reference?: string
  mapsUrl?: string
  isActive: boolean
}

export interface Plan {
  id: string
  code: string
  name: string
  description?: string
  price: { monthly: number; yearly: number; currency: string }
  features: Record<FeatureKey, FeatureValue>
  sortOrder: number
}

export interface PlatformOrganization extends Organization {
  createdAt: string
  subscription: {
    planCode: string
    status: SubscriptionStatus
    effectiveStatus: SubscriptionStatus
    trialEndsAt?: string
    currentPeriodEnd?: string
  } | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface TimeRange {
  /** Minutos desde la medianoche (9:30 → 570). */
  start: number
  end: number
}

export interface DaySchedule {
  /** 1 = lunes … 7 = domingo. */
  weekday: number
  intervals: TimeRange[]
}

export interface BranchSchedule {
  branchId: string
  days: DaySchedule[]
}

export interface Member {
  id: string
  userId: string
  roleIds: string[]
  /** Vacío = todas las sucursales. */
  branchIds: string[]
  status: 'active' | 'invited' | 'suspended'
  createdAt: string
  user: { id: string; firstName: string; lastName: string; email: string; phone?: string } | null
}

export interface Role {
  id: string
  name: string
  description?: string
  templateKey: string | null
  isLocked: boolean
}

export interface Invitation {
  id: string
  email: string
  firstName: string
  lastName: string
  roleIds: string[]
  branchIds: string[]
  status: 'pending' | 'accepted' | 'revoked'
  expiresAt: string
  createdAt: string
}

export interface InvitationSent extends Invitation {
  inviteUrl: string
  emailSent: boolean
}

export interface InvitationPreview {
  organizationName: string
  email: string
  firstName: string
  lastName: string
  roleNames: string[]
  expiresAt: string
  accountExists: boolean
}

export interface BranchWithHours extends Branch {
  openingHours: DaySchedule[]
}

/** Reglas del negocio para las órdenes (Ajustes). */
export interface OrderSettings {
  normalHours: number
  expressHours: number
  minAdvancePercent: number
  reminderAfterDays: number
  reminderEveryDays: number
  maxReminders: number
  unclaimedAfterDays: number
  ticketFooter: string
}

/** Dónde paga el cliente: se muestra en el ticket y en el portal. */
export interface PaymentInfo {
  yape: string
  plin: string
  bank: string
  notes: string
}

export interface Client {
  id: string
  firstName: string
  lastName: string
  phone?: string
  documentId?: string
  address?: string
  district?: string
  addressReference?: string
  notes?: string
  tags: string[]
  createdAt?: string
}

export interface ClientInput {
  firstName?: string
  lastName?: string
  phone?: string | null
  documentId?: string
  address?: string
  district?: string
  addressReference?: string
  notes?: string
  tags?: string[]
  /** Confirmar que es otra persona con el mismo celular. */
  allowSharedPhone?: boolean
}

export type ClientSegment = 'all' | 'new' | 'open' | 'owing' | 'at_risk' | 'vip'

export interface ClientStats {
  /** Órdenes no anuladas. */
  orders: number
  /** Órdenes que siguen en el local. */
  openOrders: number
  /** Total de sus órdenes, en céntimos. */
  spent: number
  /** Lo que aún debe, en céntimos. */
  balance: number
  lastOrderAt: string | null
}

export interface ClientDirectory {
  items: Array<Client & { stats: ClientStats }>
  total: number
  page: number
  pageSize: number
}

export interface ClientSummary {
  total: number
  new: number
  withOpenOrders: number
  owing: number
  atRisk: number
  vip: number
}
