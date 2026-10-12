import { describe, expect, it } from 'vitest'
import type { Me } from '../api/types'
import { hasFeature, meets } from './access'

const me = {
  access: { isOwner: false, branchIds: [], permissions: { 'order.read': 'own' } },
  subscription: { features: { home_delivery: false, max_branches: 3, max_members: null, max_orders_per_month: 0 } },
} as unknown as Me

describe('access', () => {
  it('interpreta flags y límites del plan', () => {
    expect(hasFeature(me, 'home_delivery')).toBe(false)
    expect(hasFeature(me, 'max_branches')).toBe(true)
    expect(hasFeature(me, 'max_members')).toBe(true) // null = ilimitado
    expect(hasFeature(me, 'max_orders_per_month')).toBe(false)
  })

  it('combina permiso y funcionalidad', () => {
    expect(meets(me, { permission: 'order.read' })).toBe(true)
    expect(meets(me, { permission: 'role.read' })).toBe(false)
    expect(meets(me, { permission: 'order.read', feature: 'home_delivery' })).toBe(false)
    expect(meets(null, {})).toBe(true)
  })
})
