import { Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/controls'
import { useBranchesWithHours } from '@/features/branches/api'
import { formatPhone } from '@/features/clients/api'
import { useOrganizationProfile } from '@/features/settings/api'
import { fileUrl } from '@/lib/api/client'
import { useAccess } from '@/lib/auth/access'
import { formatCents } from '@/lib/format'
import { summarizeSchedule } from '@/lib/schedule-summary'
import { METHOD_LABELS, STATUS_META, UNIT_META, formatQuantity, formatWhen, useOrder } from './api'

type Paper = 'thermal' | 'a4'
const PAPER_KEY = 'ulaundry-ticket-paper'

/**
 * Ticket imprimible de la orden, fuera del panel: térmica de 80 mm o A4.
 * Siempre se imprime en negro sobre blanco, sin importar el tema de la app.
 */
export function TicketPage() {
  const { id } = useParams<{ id: string }>()
  const { hasFeature } = useAccess()
  const order = useOrder(id)
  const org = useOrganizationProfile()
  const branches = useBranchesWithHours()
  const [paper, setPaper] = useState<Paper>(() => (localStorage.getItem(PAPER_KEY) === 'a4' ? 'a4' : 'thermal'))

  useEffect(() => {
    localStorage.setItem(PAPER_KEY, paper)
  }, [paper])
  useEffect(() => {
    if (order.data) document.title = `Ticket ${order.data.ticket}`
  }, [order.data])

  const o = order.data
  const business = org.data
  const branch = branches.data?.find((b) => b.id === o?.branchId)

  if (order.isLoading || org.isLoading || branches.isLoading) return <p className="p-8 text-center text-muted">Preparando el ticket…</p>
  if (!o || !business) {
    return (
      <p className="p-8 text-center">
        No encontramos esta orden.{' '}
        <Link to="/ordenes" className="font-semibold text-brand hover:underline">
          Volver a Órdenes
        </Link>
      </p>
    )
  }

  const hours = branch ? summarizeSchedule([{ branchId: branch.id, days: branch.openingHours }]) : null
  const pay = business.paymentInfo
  const validPayments = o.payments.filter((p) => p.status === 'valid')
  const thermal = paper === 'thermal'

  return (
    <div className="min-h-screen bg-surface-2 py-6 print:bg-white print:py-0">
      <style>{`@page { size: ${thermal ? '80mm auto' : 'A4'}; margin: ${thermal ? '4mm' : '14mm'}; }`}</style>

      <div className="mx-auto mb-5 flex max-w-[640px] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Segmented<Paper>
          aria-label="Tamaño de papel"
          value={paper}
          onValueChange={setPaper}
          options={[
            { value: 'thermal', label: 'Térmica 80 mm' },
            { value: 'a4', label: 'Hoja A4' },
          ]}
        />
        <div className="flex gap-2.5">
          <Button onClick={() => window.close()}>Cerrar</Button>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer size={16} aria-hidden /> Imprimir
          </Button>
        </div>
      </div>

      <article
        className="mx-auto bg-white text-black shadow-card print:shadow-none"
        style={{ width: thermal ? '72mm' : '182mm', padding: thermal ? '3mm' : '10mm', fontSize: thermal ? '11.5px' : '13.5px', lineHeight: 1.4, colorScheme: 'light' }}
      >
        <header className="text-center">
          {hasFeature('branding') && business.logoUrl && <img src={fileUrl(business.logoUrl)} alt="" className="mx-auto mb-1.5 max-h-14 max-w-[60%] object-contain" />}
          <div style={{ fontSize: '1.35em' }} className="font-bold">
            {business.name}
          </div>
          {branch && (
            <div>
              {branch.name}
              {branch.address && ` · ${branch.address}`}
            </div>
          )}
          {branch?.phone && <div>Tel. {branch.phone}</div>}
          {hours?.days ? <div>Atención: {hours.label}</div> : null}
        </header>

        <div className="my-2 border-y border-dashed border-black py-1.5 text-center">
          <div style={{ fontSize: '0.85em' }} className="tracking-[.12em] uppercase">
            Ticket
          </div>
          <div style={{ fontSize: '2.1em', lineHeight: 1.1 }} className="tabular font-bold">
            {o.ticket}
          </div>
          {o.express && <div className="font-bold tracking-[.1em] uppercase">Express</div>}
          {o.status === 'cancelled' && <div className="font-bold tracking-[.1em] uppercase">Anulada</div>}
        </div>

        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="pr-2 align-top">Cliente</td>
              <td className="text-right font-semibold">{o.clientName}</td>
            </tr>
            {o.clientPhone && (
              <tr>
                <td className="pr-2">Celular</td>
                <td className="text-right">{formatPhone(o.clientPhone)}</td>
              </tr>
            )}
            <tr>
              <td className="pr-2">Recibida</td>
              <td className="text-right">{formatWhen(o.createdAt)}</td>
            </tr>
            <tr>
              <td className="pr-2">{o.status === 'delivered' ? 'Entregada' : o.dropoff ? 'Entrega a domicilio' : 'Lista para recoger'}</td>
              <td className="text-right font-bold">{formatWhen(o.status === 'delivered' ? o.deliveredAt : o.promisedAt)}</td>
            </tr>
            <tr>
              <td className="pr-2">Estado</td>
              <td className="text-right">{STATUS_META[o.status].label}</td>
            </tr>
          </tbody>
        </table>

        <div className="my-2 border-t border-dashed border-black" />

        {o.items.length === 0 ? (
          <p className="m-0 text-center">Recojo a domicilio: el detalle se completa al pesar la ropa.</p>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {o.items.map((item, i) => (
                <tr key={i} className="align-top">
                  <td className="pb-1">
                    <div className="font-semibold">{item.name}</div>
                    <div>
                      {formatQuantity(item.quantity, item.unit)} × {formatCents(item.unitPrice)}/{UNIT_META[item.unit].per}
                    </div>
                    {item.notes && <div className="italic">{item.notes}</div>}
                  </td>
                  <td className="tabular pb-1 pl-2 text-right whitespace-nowrap">{formatCents(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {o.observations && (
          <div className="mt-1.5 border border-black p-1.5">
            <b>Observaciones:</b> {o.observations}
            {o.photos.length > 0 && ` (${o.photos.length} ${o.photos.length === 1 ? 'foto registrada' : 'fotos registradas'})`}
          </div>
        )}

        <div className="my-2 border-t border-dashed border-black" />

        <table className="w-full border-collapse">
          <tbody>
            {(o.discount > 0 || o.deliveryFee > 0) && (
              <tr>
                <td>Subtotal</td>
                <td className="tabular text-right">{formatCents(o.subtotal)}</td>
              </tr>
            )}
            {o.discount > 0 && (
              <tr>
                <td>Descuento{o.promotionName && ` (${o.promotionName})`}</td>
                <td className="tabular text-right">− {formatCents(o.discount)}</td>
              </tr>
            )}
            {o.deliveryFee > 0 && (
              <tr>
                <td>Servicio a domicilio</td>
                <td className="tabular text-right">{formatCents(o.deliveryFee)}</td>
              </tr>
            )}
            <tr className="font-bold">
              <td>Total</td>
              <td className="tabular text-right">{formatCents(o.total)}</td>
            </tr>
            {validPayments.map((p) => (
              <tr key={p.id}>
                <td>
                  Pagó ({METHOD_LABELS[p.method]}
                  {p.reference && ` ${p.reference}`})
                </td>
                <td className="tabular text-right">− {formatCents(p.amount)}</td>
              </tr>
            ))}
            <tr style={{ fontSize: '1.35em' }} className="font-bold">
              <td className="pt-1">{o.balance > 0 ? 'Saldo por pagar' : 'Pagado'}</td>
              <td className="tabular pt-1 text-right">{formatCents(o.balance)}</td>
            </tr>
          </tbody>
        </table>

        {o.balance > 0 && (pay.yape || pay.plin || pay.bank) && (
          <div className="mt-2 border-t border-dashed border-black pt-1.5">
            <b>Puedes pagar con:</b>
            {pay.yape && <div>Yape: {pay.yape}</div>}
            {pay.plin && <div>Plin: {pay.plin}</div>}
            {pay.bank && <div>{pay.bank}</div>}
            {pay.notes && <div>{pay.notes}</div>}
          </div>
        )}

        {(o.pickup || o.dropoff) && (
          <div className="mt-2 border-t border-dashed border-black pt-1.5">
            {o.pickup && (
              <div>
                <b>Recojo:</b> {o.pickup.address}
                {o.pickup.district && `, ${o.pickup.district}`}
                {o.pickup.window && ` · ${o.pickup.window}`}
              </div>
            )}
            {o.dropoff && (
              <div>
                <b>Entrega:</b> {o.dropoff.address}
                {o.dropoff.district && `, ${o.dropoff.district}`}
                {o.dropoff.window && ` · ${o.dropoff.window}`}
              </div>
            )}
          </div>
        )}

        <footer className="mt-2 border-t border-dashed border-black pt-1.5 text-center" style={{ fontSize: '0.9em' }}>
          {business.orderSettings.ticketFooter && <p className="m-0">{business.orderSettings.ticketFooter}</p>}
          <p className="m-0 mt-1 font-semibold">Presenta este ticket al recoger tu ropa.</p>
          {!hasFeature('white_label') && <p className="m-0 mt-1">Hecho con uLaundry</p>}
        </footer>
      </article>
    </div>
  )
}
