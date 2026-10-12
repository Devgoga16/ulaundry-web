import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { FormActions, FormSection } from '@/components/ui/page'
import { ApiError, errorMessage } from '@/lib/api/client'
import type { Client, ClientInput } from '@/lib/api/types'
import { formatPhone } from './api'

const schema = z.object({
  firstName: z.string().trim().min(1, 'Escribe el nombre').max(60),
  lastName: z.string().trim().max(60),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || /^9\d{8}$/.test(v.replace(/\s/g, '')), 'Celular de 9 dígitos que empiece con 9'),
  documentId: z
    .string()
    .trim()
    .refine((v) => !v || /^[A-Za-z0-9]{6,15}$/.test(v.replace(/[\s.-]/g, '')), 'DNI de 8 dígitos o carné de extranjería'),
  address: z.string().max(200),
  district: z.string().max(60),
  addressReference: z.string().max(200),
  tags: z.string(),
  notes: z.string().max(2000),
})
type Values = z.infer<typeof schema>



function toValues(c: Client | null): Values {
  return {
    firstName: c?.firstName ?? '',
    lastName: c?.lastName ?? '',
    phone: formatPhone(c?.phone),
    documentId: c?.documentId ?? '',
    address: c?.address ?? '',
    district: c?.district ?? '',
    addressReference: c?.addressReference ?? '',
    tags: (c?.tags ?? []).join(', '),
    notes: c?.notes ?? '',
  }
}

function toInput(v: Values): ClientInput {
  return {
    firstName: v.firstName,
    lastName: v.lastName,
    phone: v.phone ? v.phone.replace(/\s/g, '') : null,
    documentId: v.documentId,
    address: v.address,
    district: v.district,
    addressReference: v.addressReference,
    tags: [...new Set(v.tags.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 12),
    notes: v.notes,
  }
}

/** Datos del cliente, agrupados por tema. Sirve para crear y para editar. */
export function ClientForm({
  client,
  onSubmit,
  onCancel,
  readOnly = false,
  submitLabel,
}: {
  client: Client | null
  onSubmit: (input: ClientInput) => Promise<Client>
  onCancel?: () => void
  readOnly?: boolean
  submitLabel: string
}) {
  const [error, setError] = useState<{ message: string; existingId?: string; pending?: ClientInput } | null>(null)
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(client) })

  const save = async (input: ClientInput) => {
    setError(null)
    setSaved(false)
    try {
      const result = await onSubmit(input)
      reset(toValues(result))
      setSaved(true)
    } catch (e) {
      const code = e instanceof ApiError ? e.code : null
      const existingId =
        code === 'CLIENT_PHONE_TAKEN' || code === 'CLIENT_DOCUMENT_TAKEN' ? (e as ApiError).details?.clientId as string | undefined : undefined
      // Celular repetido: puede ser otra persona (un hijo con el número de la mamá).
      setError({ message: errorMessage(e), existingId, pending: code === 'CLIENT_PHONE_TAKEN' ? input : undefined })
    }
  }
  const submit = handleSubmit((values) => save(toInput(values)))

  return (
    <form noValidate onSubmit={submit} className="flex flex-col">
      {error && (
        <div role="alert" className="mb-4 rounded-control bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">
          {error.message}
          {error.existingId && (
            <>
              {' · '}
              <Link to={`/clientes/${error.existingId}`} className="underline underline-offset-2">
                Ver ese cliente
              </Link>
            </>
          )}
          {error.pending && (
            <div className="mt-2 flex flex-wrap items-center gap-2 font-normal text-ink-2">
              ¿Es otra persona que usa el mismo número?
              <Button size="sm" disabled={isSubmitting} onClick={() => void save({ ...error.pending, allowSharedPhone: true })}>
                Sí, guardar igual
              </Button>
            </div>
          )}
        </div>
      )}
      <fieldset disabled={readOnly || isSubmitting} className="m-0 flex min-w-0 flex-col border-0 p-0">
        <FormSection title="Datos personales" description="Cómo se llama y cómo identificarlo.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" error={errors.firstName?.message}>
              {(p) => <Input {...p} {...register('firstName')} autoFocus={!client} autoComplete="off" />}
            </Field>
            <Field label="Apellidos" error={errors.lastName?.message}>
              {(p) => <Input {...p} {...register('lastName')} autoComplete="off" />}
            </Field>
            <Field label="DNI / CE (opcional)" error={errors.documentId?.message}>
              {(p) => <Input {...p} {...register('documentId')} inputMode="numeric" autoComplete="off" />}
            </Field>
          </div>
        </FormSection>

        <FormSection title="Contacto" description="A su celular le llegan por WhatsApp el ticket, el aviso de que su ropa está lista y los recordatorios.">
          <Field label="Celular" error={errors.phone?.message} hint="9 dígitos, sin +51." className="sm:max-w-[280px]">
            {(p) => <Input {...p} {...register('phone')} inputMode="tel" placeholder="987 654 321" />}
          </Field>
        </FormSection>

        <FormSection title="Dirección" description="Para el recojo y la entrega a domicilio. Puedes dejarla vacía si siempre viene al local.">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field label="Dirección">{(p) => <Input {...p} {...register('address')} placeholder="Av. Larco 812, dpto. 302" />}</Field>
            <Field label="Distrito">{(p) => <Input {...p} {...register('district')} placeholder="Miraflores" />}</Field>
          </div>
          <Field label="Referencia" hint="Ayuda al repartidor a llegar.">
            {(p) => <Input {...p} {...register('addressReference')} placeholder="Portón verde, al lado de la bodega" />}
          </Field>
        </FormSection>

        <FormSection title="Para recepción" description="Solo lo ve tu equipo.">
          <Field label="Etiquetas" hint='Separadas por coma. "VIP" lo destaca en la lista.'>
            {(p) => <Input {...p} {...register('tags')} placeholder="VIP, Hotel, Paga a fin de mes" />}
          </Field>
          <Field label="Notas internas" hint="Solo las ve tu equipo.">
            {(p) => <Textarea {...p} {...register('notes')} rows={3} placeholder="Alérgico al suavizante, quiere las camisas en colgador…" />}
          </Field>
        </FormSection>

        {!readOnly && (
          <FormActions hint={saved && !isDirty ? 'Cambios guardados' : undefined}>
            {onCancel && (
              <Button onClick={onCancel} disabled={isSubmitting}>
                Cancelar
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={isSubmitting || (!!client && !isDirty)}>
              {isSubmitting ? 'Guardando…' : submitLabel}
            </Button>
          </FormActions>
        )}
      </fieldset>
    </form>
  )
}
