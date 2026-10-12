import { Tag as TagIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox, Segmented, Switch } from '@/components/ui/controls'
import { EmptyState, Skeleton } from '@/components/ui/display'
import { Field, Input, Textarea } from '@/components/ui/field'
import { BackLink, FormActions, FormSection } from '@/components/ui/page'
import { useServices } from '@/features/orders/api'
import { errorMessage } from '@/lib/api/client'
import { useAccess } from '@/lib/auth/access'
import { cn } from '@/lib/cn'
import { parseSoles } from '@/lib/format'
import { usePageMeta } from '@/lib/page-meta'
import { WEEKDAY_SHORT, usePromotions, useSavePromotion, type Promotion } from './api'

function PromotionForm({ promotion }: { promotion: Promotion | null }) {
  const navigate = useNavigate()
  const { readOnly } = useAccess()
  const save = useSavePromotion()
  const services = useServices(true)
  const [form, setForm] = useState({
    name: promotion?.name ?? '',
    description: promotion?.description ?? '',
    type: (promotion?.type ?? 'percent') as 'percent' | 'amount',
    value: promotion ? (promotion.type === 'percent' ? String(promotion.value) : (promotion.value / 100).toFixed(2)) : '',
    scope: (promotion?.serviceIds.length ? 'some' : 'all') as 'all' | 'some',
    serviceIds: promotion?.serviceIds ?? [],
    validFrom: promotion?.validFrom ?? '',
    validTo: promotion?.validTo ?? '',
    weekdays: promotion?.weekdays ?? [],
    minSubtotal: promotion?.minSubtotal ? (promotion.minSubtotal / 100).toFixed(2) : '',
    newClientsOnly: promotion?.newClientsOnly ?? false,
    isActive: promotion?.isActive ?? true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }))
    setSaved(false)
  }
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Ponle un nombre'
    const value = form.type === 'percent' ? Number(form.value) : parseSoles(form.value)
    if (form.type === 'percent' ? !Number.isInteger(value) || value! < 1 || value! > 100 : value === null || value <= 0) {
      next.value = form.type === 'percent' ? 'Un porcentaje entre 1 y 100' : 'Ingresa un monto mayor que cero'
    }
    if (form.scope === 'some' && form.serviceIds.length === 0) next.services = 'Elige al menos un servicio'
    if (form.validFrom && form.validTo && form.validFrom > form.validTo) next.validTo = 'Termina antes de empezar'
    const min = form.minSubtotal.trim() === '' ? 0 : parseSoles(form.minSubtotal)
    if (min === null) next.minSubtotal = 'Monto inválido'
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      const result = await save.mutateAsync({
        id: promotion?.id,
        name: form.name.trim(),
        description: form.description.trim(),
        type: form.type,
        value: value!,
        serviceIds: form.scope === 'some' ? form.serviceIds : [],
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
        weekdays: form.weekdays,
        minSubtotal: min!,
        newClientsOnly: form.newClientsOnly,
        ...(promotion && { isActive: form.isActive }),
      })
      if (!promotion) navigate(`/promociones/${result.id}`, { replace: true })
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
        <fieldset disabled={readOnly || save.isPending} className="m-0 flex min-w-0 flex-col border-0 p-0">
          <FormSection title="Promoción" description="El nombre es el que verá recepción al elegirla y el que sale en el ticket.">
            <Field label="Nombre" error={errors.name}>
              {(p) => <Input {...p} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej.: Martes de edredones" maxLength={60} autoFocus={!promotion} />}
            </Field>
            <Field label="Nota interna (opcional)">
              {(p) => <Textarea {...p} rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={200} />}
            </Field>
          </FormSection>

          <FormSection title="Descuento" description="Un porcentaje o un monto fijo. Nunca descuenta más de lo que valen los servicios incluidos.">
            <Segmented<'percent' | 'amount'>
              aria-label="Tipo de descuento"
              value={form.type}
              onValueChange={(v) => set({ type: v, value: '' })}
              options={[
                { value: 'percent', label: 'Porcentaje' },
                { value: 'amount', label: 'Monto fijo' },
              ]}
              className="self-start"
            />
            <Field label={form.type === 'percent' ? 'Porcentaje de descuento' : 'Monto de descuento'} error={errors.value} className="sm:max-w-[220px]">
              {(p) => (
                <div className="flex items-center gap-2.5">
                  {form.type === 'amount' && <span className="text-sm text-muted">S/</span>}
                  <Input {...p} value={form.value} onChange={(e) => set({ value: e.target.value.replace(form.type === 'percent' ? /\D/g : /[^\d.,]/g, '') })} inputMode="decimal" className="text-md font-semibold" />
                  {form.type === 'percent' && <span className="text-sm text-muted">%</span>}
                </div>
              )}
            </Field>
            <Segmented<'all' | 'some'>
              aria-label="Sobre qué aplica"
              value={form.scope}
              onValueChange={(v) => set({ scope: v })}
              options={[
                { value: 'all', label: 'Sobre toda la orden' },
                { value: 'some', label: 'Solo en algunos servicios' },
              ]}
              className="self-start"
            />
            {form.scope === 'some' && (
              <div className="flex flex-col gap-2">
                {(services.data ?? []).map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2.5 text-body">
                    <Checkbox checked={form.serviceIds.includes(s.id)} onCheckedChange={() => set({ serviceIds: toggle(form.serviceIds, s.id) })} />
                    {s.name}
                    {!s.isActive && <span className="text-sm text-muted">(inactivo)</span>}
                  </label>
                ))}
                {errors.services && <span className="text-2xs font-semibold text-bad">{errors.services}</span>}
              </div>
            )}
          </FormSection>

          <FormSection title="Condiciones" description="Todas son opcionales. Déjalas vacías para una promoción que vale siempre.">
            <div>
              <span className="mb-1.5 block text-2xs font-semibold text-muted">Días en que vale (ninguno marcado = todos)</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Días de la semana">
                {WEEKDAY_SHORT.map((label, i) => {
                  const on = form.weekdays.includes(i + 1)
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ weekdays: toggle(form.weekdays, i + 1) })}
                      className={cn('cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold', on ? 'border-ink bg-ink text-surface' : 'border-line-strong bg-surface text-ink-2')}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Vale desde">{(p) => <Input {...p} type="date" value={form.validFrom} onChange={(e) => set({ validFrom: e.target.value })} />}</Field>
              <Field label="Vale hasta" error={errors.validTo}>
                {(p) => <Input {...p} type="date" value={form.validTo} onChange={(e) => set({ validTo: e.target.value })} />}
              </Field>
            </div>
            <Field label="Compra mínima" hint="Sobre los servicios incluidos." error={errors.minSubtotal} className="sm:max-w-[220px]">
              {(p) => (
                <div className="flex items-center gap-2.5">
                  <span className="text-sm text-muted">S/</span>
                  <Input {...p} value={form.minSubtotal} onChange={(e) => set({ minSubtotal: e.target.value.replace(/[^\d.,]/g, '') })} inputMode="decimal" placeholder="0.00" />
                </div>
              )}
            </Field>
            <label className="flex cursor-pointer items-center gap-2.5 text-body">
              <Switch checked={form.newClientsOnly} onCheckedChange={(v) => set({ newClientsOnly: v })} />
              Solo para la primera orden de un cliente
            </label>
          </FormSection>

          {promotion && (
            <FormSection title="Estado" description="Una promoción inactiva ya no se puede aplicar. Las órdenes que la usaron no cambian.">
              <label className="flex cursor-pointer items-center gap-2.5 text-body">
                <Switch checked={form.isActive} onCheckedChange={(v) => set({ isActive: v })} />
                {form.isActive ? 'Activa' : 'Inactiva'}
              </label>
            </FormSection>
          )}

          {!readOnly && (
            <FormActions hint={saved ? 'Cambios guardados' : undefined}>
              <Button onClick={() => navigate('/promociones')}>Volver</Button>
              <Button type="submit" variant="primary">
                {save.isPending ? 'Guardando…' : promotion ? 'Guardar cambios' : 'Crear promoción'}
              </Button>
            </FormActions>
          )}
        </fieldset>
      </form>
    </Card>
  )
}

/** Promociones / promoción: crear o editar en página completa. */
export function PromotionFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'nueva'
  const promotions = usePromotions()
  const promotion = isNew ? null : (promotions.data?.find((p) => p.id === id) ?? null)
  usePageMeta({ title: isNew ? 'Nueva promoción' : (promotion?.name ?? 'Promoción'), crumb: `Promociones / ${isNew ? 'Nueva' : (promotion?.name ?? '')}` })

  return (
    <>
      <BackLink to="/promociones" label="Promociones" />
      {promotions.isLoading ? (
        <Skeleton className="h-[420px] rounded-card" />
      ) : !isNew && !promotion ? (
        <Card>
          <EmptyState
            icon={TagIcon}
            title="No encontramos esta promoción"
            action={
              <Link to="/promociones" className="text-sm font-semibold text-brand hover:underline">
                Volver a Promociones
              </Link>
            }
          />
        </Card>
      ) : (
        <PromotionForm key={promotion?.id ?? 'new'} promotion={promotion} />
      )}
    </>
  )
}
