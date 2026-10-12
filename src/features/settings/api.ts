import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { Organization, OrderSettings, PaymentInfo } from '@/lib/api/types'

export interface OrganizationProfile extends Organization {
  paymentInfo: PaymentInfo
  orderSettings: OrderSettings
}

const organizationKey = ['organization'] as const
export const orderSettingsKey = ['order-settings'] as const

export function useOrganizationProfile() {
  return useQuery({ queryKey: organizationKey, queryFn: () => api<OrganizationProfile>('/organization') })
}

export function useSaveOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name?: string; slug?: string; paymentInfo?: Partial<PaymentInfo> }) =>
      api<OrganizationProfile>('/organization', { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: organizationKey }),
  })
}

export function useOrderSettings() {
  return useQuery({ queryKey: orderSettingsKey, queryFn: () => api<OrderSettings>('/order-settings') })
}

export function useSaveOrderSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<OrderSettings>) => api<OrderSettings>('/order-settings', { method: 'PATCH', body }),
    onSuccess: (data) => qc.setQueryData(orderSettingsKey, data),
  })
}
