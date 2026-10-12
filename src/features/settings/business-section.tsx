import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/display'
import { Field, Input, Textarea } from '@/components/ui/field'
import { FormActions, FormSection } from '@/components/ui/page'
import { errorMessage } from '@/lib/api/client'
import { useAccess } from '@/lib/auth/access'
import { useAuth } from '@/lib/auth/auth-context'
import { useOrganizationProfile, useSaveOrganization, type OrganizationProfile } from './api'

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/

function BusinessForm({ org }: { org: OrganizationProfile }) {
  const { reload } = useAuth()
  const { readOnly } = useAccess()
  const save = useSaveOrganization()
  const [form, setForm] = useState({
    name: org.name,
    slug: org.slug,
    yape: org.paymentInfo.yape,
    plin: org.paymentInfo.plin,
    bank: org.paymentInfo.bank,
    notes: org.paymentInfo.notes,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }))
    setSaved(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Escribe el nombre de tu lavandería'
    if (!SLUG.test(form.slug)) next.slug = 'Entre 3 y 50 caracteres: minúsculas, números y guiones'
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      await save.mutateAsync({
        name: form.name.trim(),
        slug: form.slug,
        paymentInfo: { yape: form.yape.trim(), plin: form.plin.trim(), bank: form.bank.trim(), notes: form.notes.trim() },
      })
      await reload()
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
          <FormSection title="Tu lavandería" description="El nombre aparece en el ticket, en los avisos por WhatsApp y en el portal del cliente.">
            <Field label="Nombre" error={errors.name}>
              {(p) => <Input {...p} value={form.name} onChange={(e) => set({ name: e.target.value })} />}
            </Field>
            <Field label="Dirección web" error={errors.slug} hint="Es la dirección que usarán tus clientes para entrar a su portal.">
              {(p) => (
                <Input
                  {...p}
                  value={form.slug}
                  onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  spellCheck={false}
                  autoCapitalize="none"
                />
              )}
            </Field>
          </FormSection>

          <FormSection title="Dónde te pagan" description="Se imprime en el ticket y se muestra en el portal para que el cliente pague su saldo por Yape, Plin o transferencia.">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Yape" hint="Número y a nombre de quién.">
                {(p) => <Input {...p} value={form.yape} onChange={(e) => set({ yape: e.target.value })} placeholder="987 654 321 · Lavandería Norte" maxLength={120} />}
              </Field>
              <Field label="Plin">
                {(p) => <Input {...p} value={form.plin} onChange={(e) => set({ plin: e.target.value })} placeholder="987 654 321 · Lavandería Norte" maxLength={120} />}
              </Field>
            </div>
            <Field label="Cuenta bancaria" hint="Banco, número de cuenta y CCI.">
              {(p) => <Input {...p} value={form.bank} onChange={(e) => set({ bank: e.target.value })} placeholder="BCP Soles 191-1234567-0-12 · CCI 002-191-…" maxLength={240} />}
            </Field>
            <Field label="Indicaciones (opcional)">
              {(p) => <Textarea {...p} rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Envía la captura del pago por WhatsApp." maxLength={300} />}
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

/** Configuración / Negocio: nombre, dirección web y datos de pago. */
export function BusinessSection() {
  const org = useOrganizationProfile()
  if (org.isLoading) return <Skeleton className="h-[420px] rounded-card" />
  if (!org.data) return <p className="m-0 text-sm font-semibold text-bad">{errorMessage(org.error)}</p>
  return <BusinessForm key={org.data.id} org={org.data} />
}
