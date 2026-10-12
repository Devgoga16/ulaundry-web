import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { Branch, BranchWithHours, DaySchedule } from '@/lib/api/types'
import { branchesQueryKey } from '@/lib/auth/branch-context'

export interface BranchInput {
  name?: string
  address?: string
  reference?: string
  mapsUrl?: string
  phone?: string
  isActive?: boolean
}

export function useSaveBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: BranchInput & { id?: string }) =>
      api<Branch>(id ? `/branches/${id}` : '/branches', { method: id ? 'PATCH' : 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: branchesQueryKey }),
  })
}

export function useBranchesWithHours() {
  return useQuery({ queryKey: branchesQueryKey, queryFn: () => api<BranchWithHours[]>('/branches') })
}

export function useSaveOpeningHours() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ branchId, days }: { branchId: string; days: DaySchedule[] }) =>
      api<BranchWithHours>(`/branches/${branchId}/hours`, { method: 'PUT', body: { days } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: branchesQueryKey }),
  })
}

export function useCopyOpeningHours() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      api<BranchWithHours>(`/branches/${from}/hours/copy`, { method: 'POST', body: { toBranchId: to } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: branchesQueryKey }),
  })
}
