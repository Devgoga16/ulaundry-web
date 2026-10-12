import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Lock, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Tag } from '@/components/ui/badges'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/controls'
import { EmptyState, Skeleton } from '@/components/ui/display'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { BackLink, FormActions, FormSection } from '@/components/ui/page'
import { api, errorMessage } from '@/lib/api/client'
import type { PermissionKey, Scope } from '@/lib/api/types'
import { useAccess } from '@/lib/auth/access'
import { useAuth } from '@/lib/auth/auth-context'
import { usePageMeta } from '@/lib/page-meta'
import { useMembers } from './api'

interface RoleFull {
  id: string
  name: string
  description?: string
  templateKey: string | null
  isLocked: boolean
  permissions: Array<{ key: PermissionKey; scope: Scope }>
}
interface PermissionDef {
  key: PermissionKey
  group: string
  label: string
  scopes: Scope[]
}

const SCOPE_LABELS: Record<Scope, string> = { own: 'Solo lo asignado a él', branch: 'En sus sucursales', organization: 'En todo el negocio' }
const rolesKey = ['roles'] as const

function useRolesFull() {
  return useQuery({ queryKey: rolesKey, queryFn: () => api<RoleFull[]>('/roles') })
}
function usePermissionCatalog() {
  return useQuery({ queryKey: ['permissions'], queryFn: () => api<PermissionDef[]>('/permissions'), staleTime: Infinity })
}

function PlanNote() {
  return (
    <p className="m-0 rounded-tile bg-teal-soft px-4 py-3 text-body text-teal-ink">
      Tu plan incluye los cinco roles de fábrica. Crear roles propios o cambiar sus permisos está en el plan <b className="font-bold">Pro</b>.
    </p>
  )
}

/** Equipo / Roles: qué puede hacer cada rol y cuánta gente lo tiene. */
export function RolesPage() {
  const navigate = useNavigate()
  const { can, hasFeature, readOnly } = useAccess()
  const roles = useRolesFull()
  const members = useMembers(can('member.read'))
  const custom = hasFeature('custom_roles')
  const canManage = can('role.manage') && !readOnly && custom
  usePageMeta({ title: 'Roles y permisos', crumb: 'Negocio / Equipo / Roles' })
  const countOf = (id: string) => (members.data ?? []).filter((m) => m.roleIds.includes(id) && m.status === 'active').length

  return (
    <>
      <BackLink to="/equipo" label="Equipo" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-[60ch] text-sm text-muted">Un rol define qué ve y qué hace una persona. Puedes dar varios roles a la misma persona: se queda con el permiso más amplio de cada uno.</p>
        {canManage && (
          <Button variant="primary" onClick={() => navigate('/equipo/roles/nuevo')}>
            <Plus size={15} aria-hidden /> Nuevo rol
          </Button>
        )}
      </div>
      {!custom && <PlanNote />}
      {roles.isLoading ? (
        <Skeleton className="h-[260px] rounded-card" />
      ) : roles.isError ? (
        <p className="m-0 text-sm font-semibold text-bad">{errorMessage(roles.error)}</p>
      ) : (
        <Card>
          <ul className="m-0 list-none p-0">
            {(roles.data ?? []).map((role) => (
              <li key={role.id} className="border-t border-line first:border-t-0">
                <Link to={`/equipo/roles/${role.id}`} className="-mx-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-control px-2 py-3.5 text-ink hover:bg-surface-2">
                  <span className="grid size-11 flex-none place-items-center rounded-tile bg-brand-soft text-brand">{role.isLocked ? <Lock size={19} aria-hidden /> : <ShieldCheck size={19} aria-hidden />}</span>
                  <span className="min-w-[200px] flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {role.name}
                      {!role.templateKey && <Tag tone="teal">Propio</Tag>}
                    </span>
                    <span className="block text-sm text-muted">{role.description || 'Sin descripción'}</span>
                  </span>
                  <span className="w-[160px] text-right text-sm">
                    <span className="block font-semibold">{role.permissions.length} permisos</span>
                    {members.data && (
                      <span className="block text-muted">
                        {countOf(role.id)} {countOf(role.id) === 1 ? 'persona' : 'personas'}
                      </span>
                    )}
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

function RoleForm({ role, catalog }: { role: RoleFull | null; catalog: PermissionDef[] }) {
  const ask = useConfirm()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { reload } = useAuth()
  const { can, hasFeature, readOnly } = useAccess()
  const custom = hasFeature('custom_roles')
  const editable = can('role.manage') && !readOnly && custom && !role?.isLocked
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [granted, setGranted] = useState<Partial<Record<PermissionKey, Scope>>>(() => Object.fromEntries((role?.permissions ?? []).map((p) => [p.key, p.scope])))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: (body: { name: string; description: string; permissions: Array<{ key: PermissionKey; scope: Scope }> }) =>
      role ? api<RoleFull>(`/roles/${role.id}`, { method: 'PATCH', body }) : api<RoleFull>('/roles', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rolesKey }),
  })
  const remove = useMutation({ mutationFn: () => api<void>(`/roles/${role!.id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: rolesKey }) })

  const groups = [...new Set(catalog.map((p) => p.group))]
  const toggle = (def: PermissionDef, on: boolean) => {
    setSaved(false)
    setGranted((g) => {
      const next = { ...g }
      if (on) next[def.key] = def.scopes.includes('branch') ? 'branch' : def.scopes[0]!
      else delete next[def.key]
      return next
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2) return setError('Ponle un nombre al rol')
    const permissions = (Object.entries(granted) as Array<[PermissionKey, Scope]>).map(([key, scope]) => ({ key, scope }))
    if (permissions.length === 0) return setError('Marca al menos un permiso')
    try {
      const result = await save.mutateAsync({ name: name.trim(), description: description.trim(), permissions })
      // Si edité un rol que yo mismo tengo, mis permisos cambian.
      await reload()
      if (!role) navigate(`/equipo/roles/${result.id}`, { replace: true })
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
        {role?.isLocked && <p className="m-0 mb-4 rounded-tile bg-surface-2 px-4 py-3 text-body text-ink-2">El rol Dueño tiene acceso total y no se puede cambiar.</p>}
        {!custom && !role?.isLocked && (
          <div className="mb-4">
            <PlanNote />
          </div>
        )}
        <fieldset disabled={!editable || save.isPending} className="m-0 flex min-w-0 flex-col border-0 p-0">
          <FormSection title="Rol" description="Un nombre que tu equipo reconozca: Encargado de turno, Planchador, Cajero…">
            <Field label="Nombre">{(p) => <Input {...p} value={name} onChange={(e) => (setName(e.target.value), setSaved(false))} maxLength={50} autoFocus={!role} />}</Field>
            <Field label="Descripción (opcional)">{(p) => <Textarea {...p} rows={2} value={description} onChange={(e) => (setDescription(e.target.value), setSaved(false))} maxLength={200} />}</Field>
          </FormSection>

          {groups.map((group) => (
            <FormSection key={group} title={group}>
              {catalog
                .filter((p) => p.group === group)
                .map((def) => {
                  const scope = granted[def.key]
                  return (
                    <div key={def.key} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <label className="flex min-w-[240px] flex-1 cursor-pointer items-center gap-2.5 text-body">
                        <Checkbox checked={!!scope} onCheckedChange={(v) => toggle(def, v === true)} />
                        {def.label}
                      </label>
                      {scope &&
                        (def.scopes.length > 1 ? (
                          <Select
                            aria-label={`Alcance de: ${def.label}`}
                            value={scope}
                            onChange={(e) => (setGranted((g) => ({ ...g, [def.key]: e.target.value as Scope })), setSaved(false))}
                            className="w-auto min-w-[210px]"
                          >
                            {def.scopes.map((s) => (
                              <option key={s} value={s}>
                                {SCOPE_LABELS[s]}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="min-w-[210px] text-sm text-muted">{SCOPE_LABELS[scope]}</span>
                        ))}
                    </div>
                  )
                })}
            </FormSection>
          ))}

          {editable && (
            <FormActions hint={saved ? 'Cambios guardados' : undefined}>
              {role && !role.templateKey && (
                <Button
                  variant="danger"
                  disabled={remove.isPending}
                  onClick={async () => {
                    if (!(await ask({ title: `Eliminar el rol "${role.name}"`, description: 'No se puede deshacer. Solo se elimina si ninguna persona lo tiene asignado.', confirmLabel: 'Eliminar rol', danger: true }))) return
                    try {
                      await remove.mutateAsync()
                      navigate('/equipo/roles', { replace: true })
                    } catch (err) {
                      setError(errorMessage(err))
                    }
                  }}
                >
                  <Trash2 size={15} aria-hidden /> Eliminar
                </Button>
              )}
              <Button onClick={() => navigate('/equipo/roles')}>Volver</Button>
              <Button type="submit" variant="primary">
                {save.isPending ? 'Guardando…' : role ? 'Guardar cambios' : 'Crear rol'}
              </Button>
            </FormActions>
          )}
        </fieldset>
      </form>
    </Card>
  )
}

/** Equipo / Roles / rol: crear o editar sus permisos en página completa. */
export function RoleFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'nuevo'
  const roles = useRolesFull()
  const catalog = usePermissionCatalog()
  const role = isNew ? null : (roles.data?.find((r) => r.id === id) ?? null)
  usePageMeta({ title: isNew ? 'Nuevo rol' : (role?.name ?? 'Rol'), crumb: `Negocio / Equipo / Roles / ${isNew ? 'Nuevo' : (role?.name ?? '')}` })

  return (
    <>
      <BackLink to="/equipo/roles" label="Roles" />
      {roles.isLoading || catalog.isLoading ? (
        <Skeleton className="h-[480px] rounded-card" />
      ) : !catalog.data || (!isNew && !role) ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="No encontramos este rol"
            action={
              <Link to="/equipo/roles" className="text-sm font-semibold text-brand hover:underline">
                Volver a Roles
              </Link>
            }
          />
        </Card>
      ) : (
        <RoleForm key={role?.id ?? 'new'} role={role} catalog={catalog.data} />
      )}
    </>
  )
}
