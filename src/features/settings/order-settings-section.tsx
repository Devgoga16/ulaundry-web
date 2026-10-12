import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/display'
import { Field, Input, Textarea } from '@/components/ui/field'
import { FormActions, FormSection } from '@/components/ui/page'
import { errorMessage } from '@/lib/api/client'
import type { OrderSettings } from '@/lib/api/types'
import { useAccess } from '@/lib/auth/access'
import { useOrderSettings, useSaveOrderSettings } from './api'

type NumericKey = Exclude<keyof OrderSettings, 'ticketFooter'>

const LIMITS: Record<NumericKey, [min: number, max: number]> = {
  normalHours: [1, 720],
  expressHours: [1, 720],
  minAdvancePercent: [0, 100],
  reminderAfterDays: [1, 60],
  reminderEveryDays: [1, 60],
  maxReminders: [0, 10],
  unclaimedAfterDays: [1, 365],
}

function NumberField({
  label,
  hint,
  unit,
  value,
  error,
  onChange,
}: {
  label: string
  hint?: string
  unit: string
  value: string
  error?: string
  onChange: (v: string) => void
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(p) => (
        <div className="flex items-center gap-2.5">
          <Input {...p} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-[110px]" />
          <span className="text-sm text-muted">{unit}</span>
        </div>
      )}
    </Field>
  )
}

function OrderSettingsForm({ settings }: { settings: OrderSettings }) {
  const { readOnly, hasFeature } = useAccess()
  const save = useSaveOrderSettings()
  const [form, setForm] = useState<Record<NumericKey, string>>({
    normalHours: String(settings.normalHours),
    expressHours: String(settings.expressHours),
    minAdvancePercent: String(settings.minAdvancePercent),
    reminderAfterDays: String(settings.reminderAfterDays),
    reminderEveryDays: String(settings.reminderEveryDays),
    maxReminders: String(settings.maxReminders),
    unclaimedAfterDays: String(settings.unclaimedAfterDays),
  })
  const [footer, setFooter] = useState(settings.ticketFooter)
  const [errors, setErrors] = useState<Partial<Record<NumericKey, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const reminders = hasFeature('pickup_reminders')
  const field = (key: NumericKey) => ({
    value: form[key],
    error: errors[key],
    onChange: (v: string) => {
      setForm((f) => ({ ...f, [key]: v }))
      setSaved(false)
    },
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const next: Partial<Record<NumericKey, string>> = {}
    const values = {} as Record<NumericKey, number>
    for (const key of Object.keys(LIMITS) as NumericKey[]) {
      const [min, max] = LIMITS[key]
      const n = Number(form[key])
      if (form[key] === '' || !Number.isInteger(n) || n < min || n > max) next[key] = `Entre ${min} y ${max}`
      values[key] = n
    }
    if (!next.expressHours && !next.normalHours && values.expressHours > values.normalHours) {
      next.expressHours = 'No puede tardar más que el servicio normal'
    }
    if (!next.unclaimedAfterDays && !next.reminderAfterDays && values.unclaimedAfterDays < values.reminderAfterDays) {
      next.unclaimedAfterDays = 'No puede ser menor que el plazo del primer recordatorio'
    }
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      await save.mutateAsync({ ...values, ticketFooter: footer.trim() })
      setSaved(true)
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
          <FormSection title="Plazos de entrega" description="Con ellos se calcula la fecha prometida al registrar una orden. En cada orden se puede cambiar a mano.">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <NumberField label="Servicio normal" unit="horas" {...field('normalHours')} />
              <NumberField label="Servicio express" unit="horas" {...field('expressHours')} />
            </div>
          </FormSection>

          <FormSection title="Adelanto" description="Lo mínimo que se cobra al recibir la ropa. Con 0 no se exige adelanto.">
            <NumberField label="Adelanto mínimo" unit="% del total" {...field('minAdvancePercent')} />
          </FormSection>

          <FormSection
            title="Órdenes sin recoger"
            description={
              reminders
                ? 'Cuándo se le recuerda al cliente por WhatsApp que su orden está lista, y cuándo pasa a la lista de no recogidas.'
                : 'Cuándo una orden lista pasa a la lista de no recogidas. Los recordatorios automáticos por WhatsApp están en el plan Pro.'
            }
          >
            {reminders && (
              <div className="grid gap-3.5 sm:grid-cols-3">
                <NumberField label="Primer recordatorio" unit="días después" {...field('reminderAfterDays')} />
                <NumberField label="Repetir cada" unit="días" {...field('reminderEveryDays')} />
                <NumberField label="Máximo" unit="recordatorios" {...field('maxReminders')} />
              </div>
            )}
            <NumberField label="Se considera no recogida a los" unit="días de estar lista" {...field('unclaimedAfterDays')} />
          </FormSection>

          <FormSection title="Pie del ticket" description="Condiciones del servicio que se imprimen al final de cada ticket.">
            <Field label="Condiciones" hint={`${footer.length} de 400 caracteres`}>
              {(p) => (
                <Textarea
                  {...p}
                  rows={3}
                  maxLength={400}
                  value={footer}
                  onChange={(e) => {
                    setFooter(e.target.value)
                    setSaved(false)
                  }}
                />
              )}
            </Field>
          </FormSection>

          {!readOnly && (
            <FormActions hint={saved ? 'Cambios guardados' : undefined}>
              <Button type="submit" variant="primary">
                {save.isPending ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </FormActions>
          )}
        </fieldset>
      </form>
    </Card>
  )
}

/** Configuración / Órdenes: plazos, adelanto, recordatorios y pie del ticket. */
export function OrderSettingsSection() {
  const settings = useOrderSettings()
  if (settings.isLoading) return <Skeleton className="h-[420px] rounded-card" />
  if (!settings.data) return <p className="m-0 text-sm font-semibold text-bad">{errorMessage(settings.error)}</p>
  return <OrderSettingsForm settings={settings.data} />
}
