import { Shirt } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Segmented, Switch } from '@/components/ui/controls'
import { EmptyState, Skeleton } from '@/components/ui/display'
import { Field, Input, Textarea } from '@/components/ui/field'
import { BackLink, FormActions, FormSection } from '@/components/ui/page'
import { UNIT_META, useSaveService, useServices, type Service, type ServiceUnit } from '@/features/orders/api'
import { errorMessage } from '@/lib/api/client'
import { useAccess } from '@/lib/auth/access'
import { formatCents, parseSoles } from '@/lib/format'
import { usePageMeta } from '@/lib/page-meta'

const CATEGORY_HINTS = ['Lavado', 'Planchado', 'Lavado al seco', 'Especiales']
const toSoles = (cents: number | null | undefined) => (cents === null || cents === undefined ? '' : (cents / 100).toFixed(2))

function MoneyInput({ value, onChange, ...p }: { value: string; onChange: (v: string) => void; id: string; 'aria-invalid'?: boolean }) {
  return (
    <div className="flex">
      <span className="grid place-items-center rounded-l-control border border-r-0 border-line-strong bg-surface-2 px-3 text-body text-muted">S/</span>
      <Input {...p} value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="0.00" className="rounded-l-none" />
    </div>
  )
}

function ServiceForm({ service, categories }: { service: Service | null; categories: string[] }) {
  const navigate = useNavigate()
  const { can, readOnly } = useAccess()
  const save = useSaveService()
  const editable = can('service.manage') && !readOnly
  const [form, setForm] = useState({
    name: service?.name ?? '',
    category: service?.category ?? '',
    unit: (service?.unit ?? 'kg') as ServiceUnit,
    price: toSoles(service?.price),
    hasExpress: service ? service.expressPrice !== null : true,
    expressPrice: toSoles(service?.expressPrice),
    minQuantity: service?.minQuantity ? String(service.minQuantity) : '',
    description: service?.description ?? '',
    isActive: service?.isActive ?? true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }))
    setSaved(false)
  }
  const unit = UNIT_META[form.unit]
  const price = parseSoles(form.price)
  const express = parseSoles(form.expressPrice)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Escribe el nombre del servicio'
    if (price === null || price <= 0) next.price = 'Ingresa un precio mayor que cero'
    if (form.hasExpress && (express === null || express <= 0)) next.expressPrice = 'Ingresa el precio express'
    else if (form.hasExpress && price !== null && express !== null && express < price) next.expressPrice = 'El express no puede costar menos que el normal'
    const min = form.minQuantity === '' ? null : Number(form.minQuantity.replace(',', '.'))
    if (min !== null && (!Number.isFinite(min) || min <= 0)) next.minQuantity = 'Ingresa una cantidad válida'
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      const result = await save.mutateAsync({
        id: service?.id,
        name: form.name.trim(),
        category: form.category.trim(),
        unit: form.unit,
        price: price!,
        expressPrice: form.hasExpress ? express : null,
        minQuantity: min,
        description: form.description.trim(),
        ...(service && { isActive: form.isActive }),
      })
      if (!service) navigate(`/servicios/${result.id}`, { replace: true })
      else setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Card>
      <form noValidate onSubmit={submit} className="flex flex-col">
        {error && (
          <div role="alert" className="mb-4 rounded-control bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">
            {error}
          </div>
        )}
        <fieldset disabled={!editable || save.isPending} className="m-0 flex min-w-0 flex-col border-0 p-0">
          <FormSection title="Servicio" description="Así aparece al registrar una orden y en el ticket del cliente.">
            <Field label="Nombre" error={errors.name}>
              {(p) => <Input {...p} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej.: Lavado por kilo" autoFocus={!service} maxLength={80} />}
            </Field>
            <Field label="Categoría (opcional)" hint="Agrupa el catálogo y los reportes de ingresos.">
              {(p) => (
                <>
                  <Input {...p} value={form.category} onChange={(e) => set({ category: e.target.value })} placeholder="Ej.: Lavado" list="categorias" maxLength={40} />
                  <datalist id="categorias">
                    {[...new Set([...categories, ...CATEGORY_HINTS])].map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Descripción (opcional)">
              {(p) => <Textarea {...p} rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Incluye lavado, secado y doblado." maxLength={300} />}
            </Field>
          </FormSection>

          <FormSection title="Cómo se cobra" description="Por kilo para la ropa del día a día; por prenda para planchado o lavado al seco; por pieza para edredones, ternos y cortinas.">
            <Segmented<ServiceUnit>
              aria-label="Forma de cobro"
              value={form.unit}
              onValueChange={(v) => set({ unit: v })}
              options={[
                { value: 'kg', label: 'Por kilo' },
                { value: 'item', label: 'Por prenda' },
                { value: 'piece', label: 'Por pieza especial' },
              ]}
              className="self-start"
            />
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label={`Precio normal por ${unit.per}`} error={errors.price}>
                {(p) => <MoneyInput {...p} value={form.price} onChange={(v) => set({ price: v })} />}
              </Field>
              <Field label={`Cantidad mínima (opcional)`} hint={`Si trae menos, se cobra este mínimo. Ej.: 3 ${unit.many}.`} error={errors.minQuantity}>
                {(p) => (
                  <div className="flex items-center gap-2.5">
                    <Input {...p} value={form.minQuantity} onChange={(e) => set({ minQuantity: e.target.value.replace(/[^\d.,]/g, '') })} inputMode="decimal" className="w-[110px]" />
                    <span className="text-sm text-muted">{unit.many}</span>
                  </div>
                )}
              </Field>
            </div>
          </FormSection>

          <FormSection title="Entrega express" description="Un precio más alto a cambio de entregar en el plazo corto que definiste en Configuración.">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Switch checked={form.hasExpress} onCheckedChange={(v) => set({ hasExpress: v })} />
              {form.hasExpress ? 'Se ofrece en express' : 'No se ofrece en express'}
            </label>
            {form.hasExpress && (
              <Field
                label={`Precio express por ${unit.per}`}
                error={errors.expressPrice}
                hint={price && express && express > price ? `${formatCents(express - price)} más que el normal` : undefined}
                className="sm:max-w-[260px]"
              >
                {(p) => <MoneyInput {...p} value={form.expressPrice} onChange={(v) => set({ expressPrice: v })} />}
              </Field>
            )}
          </FormSection>

          {service && (
            <FormSection title="Estado" description="Un servicio inactivo ya no aparece al registrar órdenes. Las órdenes anteriores no cambian.">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Switch checked={form.isActive} onCheckedChange={(v) => set({ isActive: v })} />
                {form.isActive ? 'Activo' : 'Inactivo'}
              </label>
            </FormSection>
          )}

          {editable && (
            <FormActions hint={saved ? 'Cambios guardados' : undefined}>
              <Button onClick={() => navigate('/servicios')}>Volver</Button>
              <Button type="submit" variant="primary">
                {save.isPending ? 'Guardando…' : service ? 'Guardar cambios' : 'Crear servicio'}
              </Button>
            </FormActions>
          )}
        </fieldset>
      </form>
    </Card>
  )
}

/** Servicios / servicio: crear o editar en página completa. */
export function ServiceFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'nuevo'
  const services = useServices(true)
  const service = isNew ? null : (services.data?.find((s) => s.id === id) ?? null)
  usePageMeta({ title: isNew ? 'Nuevo servicio' : (service?.name ?? 'Servicio'), crumb: `Servicios / ${isNew ? 'Nuevo' : (service?.name ?? '')}` })
  const categories = [...new Set((services.data ?? []).map((s) => s.category).filter(Boolean))]

  return (
    <>
      <BackLink to="/servicios" label="Servicios" />
      {services.isLoading ? (
        <Skeleton className="h-[420px] rounded-card" />
      ) : !isNew && !service ? (
        <Card>
          <EmptyState
            icon={Shirt}
            title="No encontramos este servicio"
            action={
              <Link to="/servicios" className="text-sm font-semibold text-brand hover:underline">
                Volver a Servicios
              </Link>
            }
          />
        </Card>
      ) : (
        <ServiceForm key={service?.id ?? 'new'} service={service} categories={categories} />
      )}
    </>
  )
}
