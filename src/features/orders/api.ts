import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { TagTone } from '@/components/ui/badges'
import { api } from '@/lib/api/client'
import { LOCALE, TIMEZONE } from '@/lib/format'

/* ---------- Tipos ---------- */

export type ServiceUnit = 'kg' | 'item' | 'piece'

export interface Service {
  id: string
  name: string
  category: string
  unit: ServiceUnit
  /** Céntimos por unidad. */
  price: number
  /** `null` = no se ofrece en express. */
  expressPrice: number | null
  minQuantity: number | null
  description: string
  isActive: boolean
  sortOrder: number
}

export type ServiceInput = Omit<Service, 'id' | 'sortOrder' | 'isActive'> & { isActive?: boolean }

export type OrderStatus = 'received' | 'in_process' | 'ready' | 'delivered' | 'cancelled'
export type PaymentMethod = 'cash' | 'yape' | 'plin' | 'transfer' | 'card' | 'other'

export interface OrderItem {
  serviceId: string
  name: string
  unit: ServiceUnit
  quantity: number
  unitPrice: number
  subtotal: number
  notes: string
}

export interface DeliveryLeg {
  address: string
  district: string
  reference: string
  window: string
  status: 'pending' | 'done'
  doneAt: string | null
}

export interface OrderRow {
  id: string
  branchId: string
  number: number
  ticket: string
  clientId: string
  clientName: string
  clientPhone: string
  status: OrderStatus
  items: OrderItem[]
  express: boolean
  observations: string
  subtotal: number
  discount: number
  promotionId: string | null
  promotionName: string
  deliveryFee: number
  total: number
  paid: number
  balance: number
  promisedAt: string
  location: string
  readyAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  cancelReason: string
  pickup: DeliveryLeg | null
  dropoff: DeliveryLeg | null
  courierMembershipId: string | null
  remindersSent: number
  createdAt: string
  /** Días que lleva lista sin recoger (`null` si no está lista). */
  daysReady: number | null
  unclaimed: boolean
  overdue: boolean
}

export interface PaymentView {
  id: string
  orderId: string
  orderTicket: string
  clientId: string
  clientName: string
  branchId: string
  amount: number
  method: PaymentMethod
  reference: string
  hasProof: boolean
  status: 'valid' | 'voided'
  voidReason: string
  voidedAt: string | null
  receivedByName: string
  localDate: string
  createdAt: string
}

export interface OrderEvent {
  at: string
  type: string
  detail: string
  byName: string
}

export interface OrderDetail extends OrderRow {
  photos: Array<{ key: string; url: string }>
  history: OrderEvent[]
  payments: PaymentView[]
  courierName: string | null
}

export interface OrderSummary {
  received: number
  inProcess: number
  ready: number
  dueToday: number
  overdue: number
  unclaimed: number
  pendingPickups: number
  balance: number
  ordersWithBalance: number
}

export type OrderView = 'all' | 'open' | 'unclaimed' | 'with_balance' | 'due_today' | 'overdue' | 'delivery'

export interface OrderList {
  items: OrderRow[]
  total: number
  page: number
  pageSize: number
}

export interface LegInput {
  address: string
  district?: string
  reference?: string
  window?: string
}

export interface PaymentInput {
  amount: number
  method: PaymentMethod
  reference?: string
  proofKey?: string
}

export interface OrderInput {
  branchId?: string
  clientId?: string
  items?: Array<{ serviceId: string; quantity: number; notes?: string }>
  express?: boolean
  observations?: string
  photos?: string[]
  discount?: number
  promotionId?: string | null
  promisedAt?: string
  location?: string
  pickup?: LegInput | null
  dropoff?: LegInput | null
  deliveryFee?: number
  courierMembershipId?: string | null
  advance?: PaymentInput
}

/* ---------- Etiquetas ---------- */

export const STATUS_META: Record<OrderStatus, { label: string; tone: TagTone }> = {
  received: { label: 'Recibida', tone: 'brand' },
  in_process: { label: 'En proceso', tone: 'teal' },
  ready: { label: 'Lista', tone: 'pop' },
  delivered: { label: 'Entregada', tone: 'ok' },
  cancelled: { label: 'Anulada', tone: 'off' },
}

export const UNIT_META: Record<ServiceUnit, { label: string; per: string; one: string; many: string }> = {
  kg: { label: 'Por kilo', per: 'kg', one: 'kg', many: 'kg' },
  item: { label: 'Por prenda', per: 'prenda', one: 'prenda', many: 'prendas' },
  piece: { label: 'Por pieza especial', per: 'pieza', one: 'pieza', many: 'piezas' },
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
}
export const METHODS = Object.keys(METHOD_LABELS) as PaymentMethod[]

/** 6.5 kg · 2 prendas · 1 pieza */
export function formatQuantity(quantity: number, unit: ServiceUnit): string {
  const u = UNIT_META[unit]
  return `${Number.isInteger(quantity) ? quantity : quantity.toFixed(2).replace(/0$/, '')} ${quantity === 1 ? u.one : u.many}`
}

/** "6.5 kg Lavado por kilo · 2 Camisa planchada" */
export function itemsSummary(items: OrderItem[]): string {
  if (items.length === 0) return 'Por pesar'
  return items.map((i) => `${formatQuantity(i.quantity, i.unit)} · ${i.name}`).join(' + ')
}

const dayFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, weekday: 'short', day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, hour: 'numeric', minute: '2-digit', hour12: true })
const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE })

/** "Hoy 5:00 p. m.", "Mañana 11:00 a. m.", "mar, 13 oct 5:00 p. m." */
export function formatWhen(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '—'
  const at = new Date(iso)
  const diff = Math.round((Date.parse(ymdFmt.format(at)) - Date.parse(ymdFmt.format(now))) / 86_400_000)
  const day = diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : diff === -1 ? 'Ayer' : dayFmt.format(at)
  return `${day} ${timeFmt.format(at)}`
}

/* ---------- Servicios ---------- */

const servicesKey = ['services'] as const

export function useServices(all = false, enabled = true) {
  return useQuery({ queryKey: [...servicesKey, all], queryFn: () => api<Service[]>(`/services${all ? '?all=true' : ''}`), enabled })
}

export function useSaveService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<ServiceInput> & { id?: string }) =>
      id ? api<Service>(`/services/${id}`, { method: 'PATCH', body }) : api<Service>('/services', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: servicesKey }),
  })
}

/* ---------- Órdenes ---------- */

const ordersKey = ['orders'] as const

function query(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export function useOrders(f: { status?: OrderStatus; view?: OrderView; branchId?: string; clientId?: string; search?: string; page?: number; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: [...ordersKey, 'list', f],
    queryFn: () => api<OrderList>(`/orders${query({ ...f, view: f.view === 'all' ? undefined : f.view })}`),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useOrderSummary(branchId?: string, enabled = true) {
  return useQuery({ queryKey: [...ordersKey, 'summary', branchId ?? 'all'], queryFn: () => api<OrderSummary>(`/orders/summary${query({ branchId })}`), enabled })
}

export function useOrder(id: string | undefined) {
  return useQuery({ queryKey: [...ordersKey, 'detail', id], queryFn: () => api<OrderDetail>(`/orders/${id}`), enabled: !!id })
}

/** Todas las acciones sobre una orden refrescan órdenes, pagos, caja y clientes. */
export function useOrderActions() {
  const qc = useQueryClient()
  const refresh = (order?: OrderDetail) => {
    if (order) qc.setQueryData([...ordersKey, 'detail', order.id], order)
    void qc.invalidateQueries({ queryKey: ordersKey })
    void qc.invalidateQueries({ queryKey: ['payments'] })
    void qc.invalidateQueries({ queryKey: ['cash'] })
    void qc.invalidateQueries({ queryKey: ['clients'] })
  }
  return {
    create: useMutation({ mutationFn: (body: OrderInput) => api<OrderDetail>('/orders', { method: 'POST', body }), onSuccess: (o) => refresh(o) }),
    update: useMutation({ mutationFn: ({ id, ...body }: OrderInput & { id: string }) => api<OrderDetail>(`/orders/${id}`, { method: 'PATCH', body }), onSuccess: (o) => refresh(o) }),
    status: useMutation({ mutationFn: ({ id, ...body }: { id: string } & { status: 'received' | 'in_process' | 'ready'; location?: string }) => api<OrderDetail>(`/orders/${id}/status`, { method: 'POST', body }), onSuccess: (o) => refresh(o) }),
    deliver: useMutation({ mutationFn: ({ id, ...body }: { id: string } & { allowBalance?: boolean }) => api<OrderDetail>(`/orders/${id}/deliver`, { method: 'POST', body }), onSuccess: (o) => refresh(o) }),
    cancel: useMutation({ mutationFn: ({ id, ...body }: { id: string } & { reason: string }) => api<OrderDetail>(`/orders/${id}/cancel`, { method: 'POST', body }), onSuccess: (o) => refresh(o) }),
    completeLeg: useMutation({
      mutationFn: ({ id, leg, allowBalance }: { id: string; leg: 'pickup' | 'dropoff'; allowBalance?: boolean }) =>
        api<OrderDetail>(`/orders/${id}/delivery/${leg}/complete`, { method: 'POST', body: { allowBalance } }),
      onSuccess: (o) => refresh(o),
    }),
    pay: useMutation({
      mutationFn: ({ id, ...body }: PaymentInput & { id: string }) => api<PaymentView>(`/orders/${id}/payments`, { method: 'POST', body }),
      onSuccess: () => refresh(),
    }),
    voidPayment: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => api<PaymentView>(`/payments/${id}/void`, { method: 'POST', body: { reason } }),
      onSuccess: () => refresh(),
    }),
    notify: useMutation({ mutationFn: ({ id, kind }: { id: string; kind: 'received' | 'ready' }) => api<{ sent: boolean }>(`/orders/${id}/notify/${kind}`, { method: 'POST' }) }),
  }
}

export async function uploadOrderPhoto(file: File): Promise<{ key: string; url: string }> {
  const body = new FormData()
  body.append('file', file)
  return api<{ key: string; url: string }>('/orders/photos', { method: 'POST', body })
}

export async function uploadPaymentProof(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  return (await api<{ key: string }>('/payments/proof', { method: 'POST', body })).key
}

/* ---------- Caja ---------- */

export interface CashDay {
  branchId: string
  date: string
  totals: Record<PaymentMethod, { amount: number; count: number }>
  collected: number
  cashIn: number
  cashOut: number
  expectedCash: number
  payments: PaymentView[]
  movements: Array<{ id: string; type: 'in' | 'out'; amount: number; concept: string; createdByName: string; createdAt: string }>
  close: { expectedCash: number; countedCash: number; difference: number; notes: string; closedByName: string; closedAt: string } | null
}

const cashKey = ['cash'] as const

export function useCashDay(branchId: string | undefined, date: string) {
  return useQuery({ queryKey: [...cashKey, branchId, date], queryFn: () => api<CashDay>(`/cash/day${query({ branchId, date })}`), enabled: !!branchId })
}

export function useCashActions() {
  const qc = useQueryClient()
  const onSuccess = () => qc.invalidateQueries({ queryKey: cashKey })
  return {
    addMovement: useMutation({
      mutationFn: (body: { branchId: string; type: 'in' | 'out'; amount: number; concept: string }) => api<CashDay>('/cash/movements', { method: 'POST', body }),
      onSuccess,
    }),
    removeMovement: useMutation({ mutationFn: (id: string) => api<CashDay>(`/cash/movements/${id}`, { method: 'DELETE' }), onSuccess }),
    close: useMutation({ mutationFn: (body: { branchId: string; countedCash: number; notes?: string }) => api<CashDay>('/cash/close', { method: 'POST', body }), onSuccess }),
    reopen: useMutation({ mutationFn: (branchId: string) => api<CashDay>('/cash/reopen', { method: 'POST', body: { branchId } }), onSuccess }),
  }
}
