import { RouteTabs, useTab } from '@/components/ui/page'
import { BillingSection } from '@/features/billing/billing-section'
import { useAccess } from '@/lib/auth/access'
import { BusinessSection } from './business-section'
import { LogoSection } from './logo-section'
import { OrderSettingsSection } from './order-settings-section'

type Tab = 'negocio' | 'ordenes' | 'plan'

/** Negocio / Configuración: datos del negocio, reglas de las órdenes, y plan y pagos (Dueño). */
export function SettingsPage() {
  const { can } = useAccess()
  const canBill = can('subscription.manage')
  const allowed: Tab[] = canBill ? ['negocio', 'ordenes', 'plan'] : ['negocio', 'ordenes']
  const tab = useTab<Tab>(allowed, allowed[0]!)

  return (
    <>
      <RouteTabs<Tab>
        fallback={allowed[0]!}
        tabs={[
          { value: 'negocio', label: 'Negocio' },
          { value: 'ordenes', label: 'Órdenes' },
          ...(canBill ? [{ value: 'plan' as const, label: 'Plan y pagos' }] : []),
        ]}
      />
      {tab === 'negocio' && (
        <>
          <BusinessSection />
          <LogoSection />
        </>
      )}
      {tab === 'ordenes' && <OrderSettingsSection />}
      {tab === 'plan' && <BillingSection />}
    </>
  )
}
