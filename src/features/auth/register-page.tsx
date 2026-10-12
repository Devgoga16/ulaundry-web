import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Stepper, Timeline } from '@/components/ui/display'
import { Field, Input, PasswordInput } from '@/components/ui/field'
import { api, ApiError, errorMessage } from '@/lib/api/client'
import type { Branch } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/auth-context'
import { homeFor } from '@/lib/auth/home'
import { AuthLayout, FormError } from './auth-layout'
import { PlanPicker } from './plan-picker'
import { usePlans } from './plans'

const STEPS = ['Tu cuenta', 'Tu lavandería', 'Plan', 'Listo']

const schema = z.object({
  firstName: z.string().trim().min(1, 'Ingresa tu nombre').max(60),
  lastName: z.string().trim().min(1, 'Ingresa tu apellido').max(60),
  email: z.email('Ingresa un email válido'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^9\d{8}$/.test(v.replace(/\s/g, '')), 'Ingresa un celular de 9 dígitos que empiece con 9'),
  password: z
    .string()
    .min(10, 'Mínimo 10 caracteres')
    .regex(/(?=.*[A-Za-z])(?=.*\d)/, 'Debe incluir letras y números'),
  businessName: z.string().trim().min(2, 'Ingresa el nombre de tu lavandería').max(80),
  branchName: z.string().trim().min(2, 'Ingresa el nombre de la sede').max(80),
  branchAddress: z.string().trim().max(200),
  planCode: z.string().min(1, 'Elige un plan'),
})
type Values = z.infer<typeof schema>

const STEP_FIELDS: Array<Array<keyof Values>> = [
  ['firstName', 'lastName', 'email', 'phone', 'password'],
  ['businessName', 'branchName', 'branchAddress'],
  ['planCode'],
]

/** Registro de una lavandería nueva: cuenta, negocio, plan y listo. */
export function RegisterPage() {
  const { status, me, register: registerBusiness } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const { data: plans } = usePlans()
  // La landing preselecciona el plan con ?plan=pro.
  const [params] = useSearchParams()

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      businessName: '',
      branchName: 'Sede principal',
      branchAddress: '',
      planCode: params.get('plan') || 'pro',
    },
    mode: 'onTouched',
  })
  const {
    register,
    watch,
    setValue,
    trigger,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = form

  // Si ya había sesión al entrar, no tiene sentido registrarse.
  if (status === 'authenticated' && me && !done) return <Navigate to={homeFor(me)} replace />

  const next = async () => {
    setError(null)
    if (await trigger(STEP_FIELDS[step])) setStep((s) => s + 1)
  }

  const submit = form.handleSubmit(async (v) => {
    setError(null)
    try {
      setDone(true)
      await registerBusiness({
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        phone: v.phone ? `+51${v.phone.replace(/\s/g, '')}` : undefined,
        password: v.password,
        organization: { name: v.businessName, planCode: v.planCode },
      })
      // La API crea una sede "Principal"; la renombramos con lo que escribió.
      try {
        const [branch] = await api<Branch[]>('/branches')
        if (branch) {
          await api(`/branches/${branch.id}`, {
            method: 'PATCH',
            body: { name: v.branchName, ...(v.branchAddress && { address: v.branchAddress }) },
          })
        }
      } catch {
        // No bloquea el registro: la sede se puede editar después.
      }
      setStep(3)
    } catch (e) {
      setDone(false)
      if (e instanceof ApiError && e.code === 'EMAIL_TAKEN') {
        setStep(0)
        setFieldError('email', { message: 'Ya existe una cuenta con este email' })
        return
      }
      setError(errorMessage(e))
    }
  })

  const planCode = watch('planCode')
  const values = watch()
  const plan = plans?.find((p) => p.code === planCode)

  return (
    <AuthLayout wide>
      <div className="flex flex-col gap-5">
        <Stepper steps={STEPS} current={step} />

        <Card className="flex flex-col gap-[18px] p-6">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              if (step < 2) void next()
              else if (step === 2) void submit()
            }}
            className="flex flex-col gap-[18px]"
          >
            <FormError message={error} />

            {step === 0 && (
              <>
                <Header title="Crea tu cuenta" text="Serás el dueño de la lavandería en uLaundry." />
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label="Nombre" error={errors.firstName?.message}>
                    {(p) => <Input {...p} {...register('firstName')} autoComplete="given-name" autoFocus />}
                  </Field>
                  <Field label="Apellido" error={errors.lastName?.message}>
                    {(p) => <Input {...p} {...register('lastName')} autoComplete="family-name" />}
                  </Field>
                  <Field label="Correo electrónico" error={errors.email?.message}>
                    {(p) => <Input {...p} {...register('email')} type="email" autoComplete="email" />}
                  </Field>
                  <Field label="Celular (opcional)" hint="Ej.: 987 654 321" error={errors.phone?.message}>
                    {(p) => (
                      <div className="flex">
                        <span className="grid place-items-center rounded-l-control border border-r-0 border-line-strong bg-surface-2 px-2.5 text-body text-muted">
                          +51
                        </span>
                        <Input {...p} {...register('phone')} type="tel" inputMode="numeric" autoComplete="tel-national" className="rounded-l-none" />
                      </div>
                    )}
                  </Field>
                  <Field
                    label="Contraseña"
                    hint="Mínimo 10 caracteres, con letras y números"
                    error={errors.password?.message}
                    className="sm:col-span-2"
                  >
                    {(p) => <PasswordInput {...p} {...register('password')} autoComplete="new-password" />}
                  </Field>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <Header title="Cuéntanos de tu lavandería" text="Podrás agregar más sedes después, según tu plan." />
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label="Nombre de la lavandería" error={errors.businessName?.message} className="sm:col-span-2">
                    {(p) => <Input {...p} {...register('businessName')} placeholder="Ej.: Lavandería Norte" autoFocus />}
                  </Field>
                  <Field label="Nombre de la sede" error={errors.branchName?.message}>
                    {(p) => <Input {...p} {...register('branchName')} placeholder="Ej.: Sede Miraflores" />}
                  </Field>
                  <Field label="Dirección (opcional)" error={errors.branchAddress?.message}>
                    {(p) => <Input {...p} {...register('branchAddress')} placeholder="Ej.: Av. Larco 812, Miraflores" autoComplete="street-address" />}
                  </Field>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <Header
                  title="Elige tu plan"
                  text="Tienes 30 días gratis, sin tarjeta. Puedes cambiar de plan cuando quieras."
                />
                <PlanPicker value={planCode} onChange={(code) => setValue('planCode', code, { shouldValidate: true })} />
              </>
            )}

            {step === 3 && (
              <>
                <Header title={`¡Listo, ${values.firstName}!`} text="Tu lavandería ya está creada. Esto es lo que preparamos:" />
                <Timeline
                  items={[
                    { title: values.businessName, detail: 'Tu lavandería en uLaundry', state: 'done' },
                    { title: values.branchName, detail: values.branchAddress || 'Agrega la dirección cuando quieras', state: 'done' },
                    { title: 'Roles del equipo', detail: 'Dueño, Administrador, Recepción, Operario y Repartidor', state: 'done' },
                    { title: `30 días gratis del plan ${plan?.name ?? ''}`, detail: 'Sin tarjeta. En tu panel verás cuántos días te quedan.', state: 'done' },
                    { title: 'Siguiente: tus datos de pago y tu equipo', detail: 'Los configuras desde el panel', state: 'current' },
                  ]}
                />
              </>
            )}

            <div className="flex items-center gap-2.5 border-t border-line pt-4">
              {step > 0 && step < 3 && (
                <Button onClick={() => setStep((s) => s - 1)} disabled={isSubmitting}>
                  <ArrowLeft size={14} aria-hidden /> Atrás
                </Button>
              )}
              {step === 0 && (
                <span className="text-sm text-muted">
                  ¿Ya tienes cuenta?{' '}
                  <Link to="/login" className="font-semibold text-brand hover:underline">
                    Inicia sesión
                  </Link>
                </span>
              )}
              {step < 2 && (
                <Button type="submit" variant="primary" className="ml-auto">
                  Continuar <ArrowRight size={14} aria-hidden />
                </Button>
              )}
              {step === 2 && (
                <Button type="submit" variant="primary" className="ml-auto" disabled={isSubmitting}>
                  {isSubmitting ? 'Creando tu lavandería…' : 'Crear mi lavandería'} <Check size={14} aria-hidden />
                </Button>
              )}
              {step === 3 && (
                <Button variant="primary" className="ml-auto" onClick={() => navigate('/', { replace: true })}>
                  Ir a mi panel <ArrowRight size={14} aria-hidden />
                </Button>
              )}
            </div>
            {step === 2 && (
              <p className="m-0 text-sm text-muted">
                Al crear tu lavandería aceptas los{' '}
                <Link to="/terminos" target="_blank" className="font-semibold text-brand hover:underline">
                  Términos y condiciones
                </Link>{' '}
                y la{' '}
                <Link to="/privacidad" target="_blank" className="font-semibold text-brand hover:underline">
                  Política de privacidad
                </Link>
                .
              </p>
            )}
          </form>
        </Card>
      </div>
    </AuthLayout>
  )
}

function Header({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="m-0 mb-1.5 text-2xl font-semibold">{title}</h2>
      <p className="m-0 text-muted">{text}</p>
    </div>
  )
}
