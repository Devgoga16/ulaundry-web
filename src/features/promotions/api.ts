import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { formatCents } from '@/lib/format'

export interface Promotion {
  id: string
  name: string
  description: string
  type: 'percent' | 'amount'
  /** Porcentaje (1–100) o céntimos. */
  value: number
  /** Vacío = toda la orden. */
  serviceIds: string[]
  validFrom: string | null
  validTo: string | null
  /** Días ISO (1 = lunes). Vacío = todos. */
  weekdays: number[]
  minSubtotal: number
  newClientsOnly: boolean
  isActive: boolean
  uses: number
  discounted: number
}

export type PromotionInput = Omit<Promotion, 'id' | 'uses' | 'discounted' | 'isActive'> & { isActive?: boolean }

const key = ['promotions'] as const

export function usePromotions(onlyActive = false, enabled = true) {
  return useQuery({ queryKey: [...key, onlyActive], queryFn: () => api<Promotion[]>(`/promotions${onlyActive ? '?active=true' : ''}`), enabled })
}

export function useSavePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<PromotionInput> & { id?: string }) =>
      id ? api<Promotion>(`/promotions/${id}`, { method: 'PATCH', body }) : api<Promotion>('/promotions', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

/** "10 %" o "S/ 5.00" */
export function promotionValue(p: Pick<Promotion, 'type' | 'value'>): string {
  return p.type === 'percent' ? `${p.value} %` : formatCents(p.value)
}

export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const dmy = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`

/** Condiciones en una línea: "Mar, Jue · hasta 31/12/2026 · mínimo S/ 30.00 · solo primera orden". */
export function promotionRules(p: Promotion): string {
  const parts = [
    p.weekdays.length ? [...p.weekdays].sort().map((d) => WEEKDAY_SHORT[d - 1]).join(', ') : null,
    p.validFrom && p.validTo ? `del ${dmy(p.validFrom)} al ${dmy(p.validTo)}` : p.validFrom ? `desde ${dmy(p.validFrom)}` : p.validTo ? `hasta ${dmy(p.validTo)}` : null,
    p.minSubtotal ? `mínimo ${formatCents(p.minSubtotal)}` : null,
    p.newClientsOnly ? 'solo primera orden' : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Sin condiciones'
}
