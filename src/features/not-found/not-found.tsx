import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/display'

/** Dirección que no corresponde a ninguna pantalla del panel. */
export function NotFound() {
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="No encontramos esta página"
        description="Puede que el enlace esté incompleto o que la pantalla haya cambiado de lugar."
        action={
          <Link to="/" className="text-sm font-semibold text-brand hover:underline">
            Ir al inicio
          </Link>
        }
      />
    </Card>
  )
}
