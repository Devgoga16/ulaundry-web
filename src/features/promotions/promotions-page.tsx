import { ChevronRight, Plus, Tag as TagIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Tag } from '@/components/ui/badges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/display'
import { useServices } from '@/features/orders/api'
import { errorMessage } from '@/lib/api/client'
import { useAccess } from '@/lib/auth/access'
import { cn } from '@/lib/cn'
import { formatCents } from '@/lib/format'
import { promotionRules, promotionValue, usePromotions } from './api'

/** Promociones: descuentos que recepción aplica al registrar una orden. */
export function PromotionsPage() {
  const navigate = useNavigate()
  const { readOnly } = useAccess()
  const promotions = usePromotions()
  const services = useServices(true)
  const list = promotions.data ?? []
  const serviceName = (id: string) => services.data?.find((s) => s.id === id)?.name ?? 'Servicio'

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-[60ch] text-sm text-muted">Al registrar una orden, recepción elige la promoción y el descuento se calcula solo. Si la orden no cumple las condiciones, no se puede aplicar.</p>
        {!readOnly && (
          <Button variant="primary" onClick={() => navigate('/promociones/nueva')}>
            <Plus size={15} aria-hidden /> Nueva promoción
          </Button>
        )}
      </div>

      {promotions.isLoading ? (
        <Skeleton className="h-[220px] rounded-card" />
      ) : promotions.isError ? (
        <p className="m-0 text-sm font-semibold text-bad">{errorMessage(promotions.error)}</p>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={TagIcon}
            title="Aún no tienes promociones"
            description="Por ejemplo: 10 % los martes, S/ 5 menos en edredones o 20 % en la primera orden de un cliente nuevo."
            action={
              !readOnly && (
                <Button variant="primary" size="sm" onClick={() => navigate('/promociones/nueva')}>
                  <Plus size={14} aria-hidden /> Crear una promoción
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Card>
          <ul className="m-0 list-none p-0">
            {list.map((p) => (
              <li key={p.id} className="border-t border-line first:border-t-0">
                <Link to={`/promociones/${p.id}`} className={cn('-mx-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-control px-2 py-3.5 text-ink hover:bg-surface-2', !p.isActive && 'opacity-60')}>
                  <span className="grid h-12 min-w-[84px] flex-none place-items-center rounded-tile bg-pop-soft px-3 text-md font-bold text-pop-ink">− {promotionValue(p)}</span>
                  <span className="min-w-[200px] flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {p.name}
                      {!p.isActive && <Tag tone="off">Inactiva</Tag>}
                    </span>
                    <span className="block text-sm text-ink-2">{p.serviceIds.length ? `Sobre: ${p.serviceIds.map(serviceName).join(', ')}` : 'Sobre toda la orden'}</span>
                    <span className="block text-sm text-muted">{promotionRules(p)}</span>
                  </span>
                  <span className="w-[150px] text-right text-sm">
                    <span className="block font-semibold">
                      {p.uses} {p.uses === 1 ? 'orden' : 'órdenes'}
                    </span>
                    <span className="block text-muted">{formatCents(p.discounted)} descontados</span>
                  </span>
                  <ChevronRight size={18} className="flex-none text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
