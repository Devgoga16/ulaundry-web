import { describe, expect, it } from 'vitest'
import { apiBaseUrl } from './client'

describe('apiBaseUrl', () => {
  it('sin variable usa el mismo origen', () => {
    expect(apiBaseUrl(undefined)).toBe('/api')
    expect(apiBaseUrl('  ')).toBe('/api')
  })
  it('agrega /api si falta y quita barras finales', () => {
    expect(apiBaseUrl('https://api.ulaundry.pe')).toBe('https://api.ulaundry.pe/api')
    expect(apiBaseUrl('https://api.ulaundry.pe/')).toBe('https://api.ulaundry.pe/api')
    expect(apiBaseUrl('https://api.ulaundry.pe/api/')).toBe('https://api.ulaundry.pe/api')
  })
})
