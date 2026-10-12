import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Button } from './button'
import { Modal } from './overlays'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  /** Texto del botón que confirma. */
  confirmLabel?: string
  cancelLabel?: string
  /** Acción que quita o bloquea algo: el botón va en rojo. */
  danger?: boolean
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Confirm | null>(null)

/** Diálogo de confirmación propio, en lugar del `confirm()` del navegador. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback<Confirm>((next) => {
    // Si ya había una pregunta abierta, se da por cancelada.
    resolver.current?.(false)
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const answer = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!options} onOpenChange={(open) => !open && answer(false)} title={options?.title ?? ''} className="w-[min(440px,calc(100%-32px))]">
        {options?.description && <div className="text-body text-ink-2">{options.description}</div>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {/* En una acción que quita o bloquea algo, Enter no debe confirmarla por accidente. */}
          <Button autoFocus={!!options?.danger} onClick={() => answer(false)}>
            {options?.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button variant={options?.danger ? 'danger' : 'primary'} autoFocus={!options?.danger} onClick={() => answer(true)}>
            {options?.confirmLabel ?? 'Confirmar'}
          </Button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>')
  return confirm
}
