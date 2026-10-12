import { ChevronRight, Plus, Shirt, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Tag } from '@/components/ui/badges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FilterChips } from '@/components/ui/controls'
import { EmptyState, Skeleton } from '@/components/ui/display'
import { UNIT_META, useServices, type Service, type ServiceUnit } from '@/features/orders/api'
import { errorMessage } from '@/lib/api/client'
import { useAccess } from '@/lib/auth/access'
import { cn } from '@/lib/cn'
import { formatCents } from '@/lib/format'

type Filter = 'all' | ServiceUnit

function ServiceRow({ service }: { service: Service }) {
  const unit = UNIT_META[service.unit]
  return (
    <li className="border-t border-line first:border-t-0">
      <Link
        to={`/servicios/${service.id}`}
        className={cn('-mx-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-control px-2 py-3.5 text-ink hover:bg-surface-2', !service.isActive && 'opacity-60')}
      >
        <span className="min-w-[200px] flex-1">
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            {service.name}
            {!service.isActive && <Tag tone="off">Inactivo</Tag>}
          </span>
          <span className="block text-sm text-muted">
            {unit.label}
            {service.minQuantity ? ` · mínimo ${service.minQuantity} ${unit.many}` : ''}
          </span>
        </span>
        <span className="w-[130px] text-right">
          <span className="tabular block text-md font-semibold">{formatCents(service.price)}</span>
          <span className="block text-xs text-muted">por {unit.per}</span>
        </span>
        <span className="w-[130px] text-right">
          {service.expressPrice !== null ? (
            <>
              <span className="tabular flex items-center justify-end gap-1 text-md font-semibold text-pop-ink">
                <Zap size={14} aria-hidden /> {formatCents(service.expressPrice)}
              </span>
              <span className="block text-xs text-muted">express</span>
            </>
          ) : (
            <span className="text-sm text-muted">Sin express</span>
          )}
        </span>
        <ChevronRight size={18} className="flex-none text-muted" aria-hidden />
      </Link>
    </li>
  )
}

/** Servicios: el catálogo con sus precios, agrupado por categoría. */
export function ServicesPage() {
  const navigate = useNavigate()
  const { can, readOnly } = useAccess()
  const canManage = can('service.manage') && !readOnly
  const services = useServices(canManage)
  const [filter, setFilter] = useState<Filter>('all')

  const all = services.data ?? []
  const shown = all.filter((s) => filter === 'all' || s.unit === filter)
  const categories = [...new Set(shown.map((s) => s.category || 'Sin categoría'))]
  const count = (u: ServiceUnit) => all.filter((s) => s.unit === u).length

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips<Filter>
          aria-label="Forma de cobro"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: 'all', label: `Todos · ${all.length}` },
            { value: 'kg', label: `Por kilo · ${count('kg')}` },
            { value: 'item', label: `Por prenda · ${count('item')}` },
            { value: 'piece', label: `Piezas especiales · ${count('piece')}` },
          ]}
        />
        {canManage && (
          <Button variant="primary" onClick={() => navigate('/servicios/nuevo')}>
            <Plus size={15} aria-hidden /> Nuevo servicio
          </Button>
        )}
      </div>

      {services.isLoading ? (
        <Skeleton className="h-[240px] rounded-card" />
      ) : services.isError ? (
        <p className="m-0 text-sm font-semibold text-bad">{errorMessage(services.error)}</p>
      ) : all.length === 0 ? (
        <Card>
          <EmptyState
            icon={Shirt}
            title="Aún no tienes servicios"
            description="Crea lo que ofreces con su precio: lavado por kilo, planchado por prenda, edredones, ternos, cortinas…"
            action={
              canManage && (
                <Button variant="primary" size="sm" onClick={() => navigate('/servicios/nuevo')}>
                  <Plus size={14} aria-hidden /> Crear mi primer servicio
                </Button>
              )
            }
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <p className="m-0 py-6 text-center text-sm text-muted">No tienes servicios de este tipo.</p>
        </Card>
      ) : (
        categories.map((category) => (
          <Card key={category}>
            <h3 className="m-0 mb-1 text-sm font-bold tracking-[.08em] text-muted uppercase">{category}</h3>
            <ul className="m-0 list-none p-0">
              {shown
                .filter((s) => (s.category || 'Sin categoría') === category)
                .map((s) => (
                  <ServiceRow key={s.id} service={s} />
                ))}
            </ul>
          </Card>
        ))
      )}
    </>
  )
}
