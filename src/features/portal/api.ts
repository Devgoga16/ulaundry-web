import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OrderStatus, PaymentMethod, ServiceUnit } from '@/features/orders/api'
import { ApiError, api } from '@/lib/api/client'
import type { DaySchedule, PaymentInfo } from '@/lib/api/types'

/** Lo que cualquiera ve del negocio antes de entrar. */
export interface PublicBusiness {
  name: string
  slug: string
  logoUrl: string | null
  portalEnabled: boolean
  whiteLabel: boolean
  branches: Array<{ id: string; name: string; address: string; reference: string; phone: string; mapsUrl: string; openingHours: DaySchedule[] }>
}

export interface PortalProfile {
  id: string
  firstName: string
  lastName: string
  address: string
  district: string
  addressReference: string
}

export interface PortalAccount {
  phone: string
  features: { homeDelivery: boolean }
  profiles: PortalProfile[]
}

export interface PortalLeg {
  address: string
  district: string
  window: string
  status: 'pending' | 'done'
}

export interface PortalOrder {
  id: string
  clientId: string
  ticket: string
  status: OrderStatus
  express: boolean
  items: Array<{ name: string; unit: ServiceUnit; quantity: number; subtotal: number; notes: string }>
  observations: string
  subtotal: number
  discount: number
  promotionName: string
  deliveryFee: number
  total: number
  paid: number
  balance: number
  createdAt: string
  promisedAt: string
  readyAt: string | null
  deliveredAt: string | null
  daysReady: number | null
  pickup: PortalLeg | null
  dropoff: PortalLeg | null
  branch: { id: string; name: string; address: string; mapsUrl: string; phone: string }
  open: boolean
}

export interface PortalOrders {
  /** Las que siguen en la lavandería. */
  active: PortalOrder[]
  past: PortalOrder[]
  balance: number
  paymentInfo: PaymentInfo
}

export interface PortalPayment {
  id: string
  orderId: string
  orderTicket: string
  clientId: string
  /** Fecha local "YYYY-MM-DD". */
  date: string
  amount: number
  method: PaymentMethod
  reference: string
}

export interface ProfileInput {
  clientId: string
  firstName?: string
  lastName?: string
  address?: string
  district?: string
  addressReference?: string
}

export interface PickupInput {
  clientId?: string
  branchId?: string
  address: string
  district?: string
  reference?: string
  window?: string
  notes?: string
}

interface StoredSession {
  token: string
  /** Celular en formato +51987654321. */
  phone: string
}

/** La sesión del portal vive en este navegador y vale solo para un negocio. */
const storageKey = (slug: string) => `ulaundry.portal.${slug}`

export const portalSession = {
  get(slug: string): StoredSession | null {
    try {
      const raw = localStorage.getItem(storageKey(slug))
      const parsed = raw ? (JSON.parse(raw) as Partial<StoredSession>) : null
      return parsed?.token && parsed.phone ? { token: parsed.token, phone: parsed.phone } : null
    } catch {
      return null
    }
  },
  set(slug: string, session: StoredSession) {
    try {
      localStorage.setItem(storageKey(slug), JSON.stringify(session))
    } catch {
      // Navegación privada sin almacenamiento: la sesión dura lo que la pestaña.
    }
  },
  clear(slug: string) {
    try {
      localStorage.removeItem(storageKey(slug))
    } catch {
      // Nada que borrar.
    }
  },
}

const base = (slug: string) => `/public/businesses/${slug}/portal`
export const portalHeaders = (token: string) => ({ 'x-portal-token': token })
const withToken = (token: string) => ({ headers: portalHeaders(token), skipRefresh: true })

export function useBusiness(slug: string) {
  return useQuery({ queryKey: ['portal', slug, 'business'], queryFn: () => api<PublicBusiness>(`/public/businesses/${slug}`, { skipRefresh: true }), retry: false, staleTime: 5 * 60_000 })
}

export function requestPortalCode(slug: string, phone: string) {
  return api<{ ok: true; expiresInSeconds: number }>(`${base(slug)}/code`, { method: 'POST', body: { phone }, skipRefresh: true })
}

export function openPortalSession(slug: string, phone: string, code: string) {
  return api<PortalAccount & { token: string; expiresAt: string }>(`${base(slug)}/session`, { method: 'POST', body: { phone, code }, skipRefresh: true })
}

export const isSessionExpired = (error: unknown) => error instanceof ApiError && error.status === 401

export function usePortalAccount(slug: string, token: string | null) {
  return useQuery({ queryKey: ['portal', slug, 'me', token], queryFn: () => api<PortalAccount>(`${base(slug)}/me`, withToken(token!)), enabled: !!token, retry: false, staleTime: 30_000 })
}

export function usePortalOrders(slug: string, token: string | null) {
  return useQuery({ queryKey: ['portal', slug, 'orders', token], queryFn: () => api<PortalOrders>(`${base(slug)}/orders`, withToken(token!)), enabled: !!token, retry: false })
}

export function usePortalPayments(slug: string, token: string | null) {
  return useQuery({
    queryKey: ['portal', slug, 'payments', token],
    queryFn: () => api<{ items: PortalPayment[]; totalThisYear: number }>(`${base(slug)}/payments`, withToken(token!)),
    enabled: !!token,
    retry: false,
  })
}

export function usePortalActions(slug: string, token: string) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['portal', slug] })
  return {
    updateProfile: useMutation({
      mutationFn: ({ clientId, ...body }: ProfileInput) => api<PortalProfile>(`${base(slug)}/profiles/${clientId}`, { method: 'PATCH', body, ...withToken(token) }),
      onSuccess: refresh,
    }),
    requestPickup: useMutation({
      mutationFn: (body: PickupInput) => api<{ id: string; ticket: string }>(`${base(slug)}/pickups`, { method: 'POST', body, ...withToken(token) }),
      onSuccess: refresh,
    }),
  }
}

/* ---------- Texto ---------- */

export const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim()
export const prettyPhone = (phone: string) => phone.replace(/^\+51/, '').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')

export const personName = (profiles: PortalProfile[], clientId: string) => {
  const p = profiles.find((x) => x.id === clientId)
  return p ? fullName(p) : ''
}
