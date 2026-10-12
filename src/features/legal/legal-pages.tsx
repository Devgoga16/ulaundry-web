import { ArrowLeft } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/brand/logo'

/** Fecha de la última revisión de ambos documentos. */
const UPDATED = '11 de octubre de 2026'
const COMPANY = 'Unify Tec'

function LegalLayout({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · uLaundry`
    window.scrollTo(0, 0)
  }, [title])

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="border-b border-line px-4 py-4">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-4">
          <Link to="/inicio" aria-label="uLaundry, inicio" className="no-underline">
            <Logo size="sm" />
          </Link>
          <Link to="/inicio" className="inline-flex items-center gap-1.5 text-body font-semibold text-ink-2 no-underline hover:underline">
            <ArrowLeft size={16} aria-hidden /> Volver
          </Link>
        </div>
      </header>

      <main className="px-4 py-10 sm:py-14">
        <article className="mx-auto max-w-[760px]">
          <p className="m-0 text-sm font-semibold tracking-[.12em] text-teal-ink uppercase">Última actualización: {UPDATED}</p>
          <h1 className="m-0 mt-2 text-[clamp(30px,5vw,44px)] leading-[1.08] font-bold tracking-[-.025em]">{title}</h1>
          <p className="mt-4 mb-0 text-md leading-relaxed text-ink-2">{intro}</p>
          <div className="mt-8 flex flex-col gap-8">{children}</div>
        </article>
      </main>

      <footer className="border-t border-line px-4 py-8">
        <div className="mx-auto flex max-w-[760px] flex-wrap items-center justify-between gap-4 text-sm text-muted">
          <span>{COMPANY} · Hecho en Perú</span>
          <span className="flex gap-5">
            <Link to="/terminos" className="font-semibold text-ink-2 no-underline hover:underline">
              Términos
            </Link>
            <Link to="/privacidad" className="font-semibold text-ink-2 no-underline hover:underline">
              Privacidad
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="m-0 text-xl font-bold">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-body leading-relaxed text-ink-2 [&_li]:mt-1.5 [&_p]:m-0 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </section>
  )
}

export function TermsPage() {
  return (
    <LegalLayout
      title="Términos y condiciones"
      intro={`Estas son las reglas para usar uLaundry, el sistema de ${COMPANY} para lavanderías en Perú. Al crear una cuenta o usar el sistema, las aceptas.`}
    >
      <Section title="1. Qué es uLaundry">
        <p>
          uLaundry es un sistema en la web para que una lavandería registre sus órdenes, sus clientes y sus cobros, avise a sus clientes por WhatsApp y les dé un portal para seguir su ropa. {COMPANY} presta el sistema; la lavandería
          presta su servicio de lavado y es la única responsable ante sus clientes por las prendas, los precios, los plazos y los cobros.
        </p>
      </Section>

      <Section title="2. Tu cuenta">
        <ul>
          <li>Quien crea la lavandería en uLaundry es su dueño en el sistema y decide a quién invita y con qué permisos.</li>
          <li>Cada persona entra con su propio correo y contraseña. No compartas tu acceso: lo que se haga con tu cuenta queda registrado a tu nombre.</li>
          <li>Los datos que registres deben ser verdaderos y debes tener derecho a usarlos.</li>
        </ul>
      </Section>

      <Section title="3. Prueba gratis, planes y pagos">
        <ul>
          <li>Toda lavandería nueva tiene 30 días de prueba gratis en el plan que elija, sin tarjeta.</li>
          <li>Al terminar la prueba o un periodo pagado, la cuenta queda en solo lectura: se puede consultar todo, pero no registrar, hasta que se confirme un pago.</li>
          <li>Los precios están en soles y se muestran en la página de planes. El plan se paga por mes o por año, por adelantado.</li>
          <li>
            uLaundry no cobra de forma automática ni guarda tarjetas. Pagas por Yape, Plin, transferencia o depósito, registras el pago con su comprobante y lo confirmamos en un máximo de 24 horas hábiles. No hay renovación
            automática.
          </li>
          <li>Puedes cambiar de plan cuando quieras. Si bajas a un plan con menos funciones, lo ya registrado se conserva, pero esas funciones dejan de estar disponibles.</li>
          <li>Podemos cambiar los precios para periodos futuros. Un periodo ya pagado no cambia de precio.</li>
        </ul>
      </Section>

      <Section title="4. Cobros a tus clientes">
        <p>
          uLaundry no procesa ni recibe el dinero de tus clientes. Tú cobras como siempre (efectivo, Yape, Plin, transferencia o tarjeta) y registras el pago en el sistema. Los datos de Yape, Plin o cuenta bancaria que configures se
          muestran en el ticket y en el portal tal como los escribiste: revisa que sean correctos.
        </p>
      </Section>

      <Section title="5. Avisos por WhatsApp">
        <ul>
          <li>El sistema envía avisos a tus clientes (orden recibida, orden lista, recordatorios de recojo y códigos de ingreso al portal) al celular que registres en cada cliente.</li>
          <li>Eres responsable de que ese número sea del cliente y de que haya aceptado recibir avisos sobre su orden.</li>
          <li>La entrega de los mensajes depende de WhatsApp y de la conexión del cliente. No garantizamos que todos lleguen; el estado de cada orden siempre se puede consultar en el sistema y en el portal.</li>
        </ul>
      </Section>

      <Section title="6. Uso permitido">
        <p>No está permitido usar uLaundry para enviar publicidad no solicitada, registrar datos de personas sin relación con tu lavandería, intentar entrar a datos de otros negocios, ni interferir con el funcionamiento del sistema.</p>
        <p>Podemos suspender una cuenta que incumpla estos términos o que ponga en riesgo a otros usuarios. Si es posible, avisaremos antes.</p>
      </Section>

      <Section title="7. Tus datos">
        <p>
          Lo que registras (órdenes, clientes, pagos, fotos) es de tu lavandería. Nosotros lo guardamos y lo procesamos solo para prestarte el servicio, como se explica en la{' '}
          <Link to="/privacidad" className="font-semibold text-brand">
            Política de privacidad
          </Link>
          . Si dejas de usar uLaundry, puedes pedir por soporte que eliminemos tu negocio y sus datos.
        </p>
      </Section>

      <Section title="8. Disponibilidad y soporte">
        <ul>
          <li>Trabajamos para que el sistema esté disponible todo el tiempo, pero puede haber interrupciones por mantenimiento o por fallas de terceros (internet, servidores, WhatsApp).</li>
          <li>El soporte se atiende desde la sección "Ayuda y soporte" del sistema.</li>
          <li>El personal de soporte puede entrar a tu panel en modo de solo lectura para ayudarte. Cada ingreso queda registrado en la auditoría de tu negocio.</li>
        </ul>
      </Section>

      <Section title="9. Responsabilidad">
        <p>
          uLaundry es una herramienta de registro. No respondemos por prendas perdidas o dañadas, por diferencias de caja, ni por acuerdos entre la lavandería y sus clientes. En lo que la ley permita, nuestra responsabilidad frente a
          una lavandería se limita a lo que pagó por el servicio en los tres meses anteriores al hecho.
        </p>
      </Section>

      <Section title="10. Cambios y ley aplicable">
        <p>Si cambiamos estos términos, publicaremos la nueva versión aquí con su fecha. Seguir usando el sistema después del cambio significa que la aceptas.</p>
        <p>Estos términos se rigen por las leyes de la República del Perú.</p>
      </Section>
    </LegalLayout>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Política de privacidad"
      intro={`Aquí explicamos qué datos personales trata uLaundry, para qué y quién responde por ellos, conforme a la Ley N.º 29733, Ley de Protección de Datos Personales del Perú, y su reglamento.`}
    >
      <Section title="1. Quién responde por tus datos">
        <ul>
          <li>
            <b className="font-semibold text-ink">Si eres cliente de una lavandería:</b> la lavandería que te atiende decide qué datos tuyos registra y para qué; ella es la titular de ese banco de datos. {COMPANY} los guarda y procesa
            por encargo de la lavandería, solo para que el sistema funcione.
          </li>
          <li>
            <b className="font-semibold text-ink">Si eres dueño o parte del equipo de una lavandería:</b> {COMPANY} es responsable de los datos de tu cuenta de usuario.
          </li>
        </ul>
      </Section>

      <Section title="2. Qué datos se tratan">
        <ul>
          <li>
            <b className="font-semibold text-ink">De los clientes de una lavandería:</b> nombre, celular, y si la lavandería los registra, documento de identidad, dirección, distrito y referencia para recojos y entregas. También sus
            órdenes (servicios, observaciones y fotos de las prendas), sus pagos y los comprobantes que se adjunten, y las consultas que envíen desde el portal.
          </li>
          <li>
            <b className="font-semibold text-ink">Del equipo de una lavandería:</b> nombre, correo, contraseña (guardada cifrada, nunca en texto legible), rol, y el registro de lo que hace en el sistema.
          </li>
          <li>
            <b className="font-semibold text-ink">Datos técnicos:</b> fecha y dispositivo de cada inicio de sesión, para proteger la cuenta.
          </li>
        </ul>
        <p>No pedimos ni guardamos números de tarjeta ni claves bancarias.</p>
      </Section>

      <Section title="3. Para qué se usan">
        <ul>
          <li>Registrar y entregar las órdenes, y llevar la cuenta de lo cobrado y lo pendiente.</li>
          <li>Enviar por WhatsApp los avisos de la orden (recibida, lista, recordatorio de recojo) y el código para entrar al portal.</li>
          <li>Coordinar recojos y entregas a domicilio cuando el cliente los pide.</li>
          <li>Dar acceso a cada persona del equipo según su rol y dejar constancia de quién hizo cada cosa.</li>
          <li>Atender soporte y mantener la seguridad del sistema.</li>
        </ul>
        <p>No vendemos datos personales ni los usamos para publicidad de terceros.</p>
      </Section>

      <Section title="4. Con quién se comparten">
        <p>Para funcionar, uLaundry usa proveedores que tratan datos por nuestro encargo: alojamiento de la base de datos y de los archivos, envío de correos y envío de mensajes de WhatsApp. Algunos pueden estar fuera del Perú.</p>
        <p>Fuera de eso, solo entregamos datos si una autoridad competente lo exige conforme a ley.</p>
      </Section>

      <Section title="5. Cuánto tiempo se guardan">
        <p>
          Los datos se conservan mientras la lavandería use uLaundry. Cuando una lavandería pide eliminar su negocio, se borran sus órdenes, clientes, pagos, archivos y accesos. Los códigos de ingreso al portal vencen a los 10 minutos
          y la sesión del portal dura 30 días en el dispositivo donde se abrió.
        </p>
      </Section>

      <Section title="6. Cómo se protegen">
        <ul>
          <li>Cada lavandería ve solo sus propios datos; el sistema los mantiene separados de los de otros negocios.</li>
          <li>La conexión viaja cifrada y las contraseñas se guardan cifradas.</li>
          <li>Las fotos y comprobantes son privados: se abren con enlaces temporales y solo para quien tiene permiso.</li>
          <li>El ingreso del personal de soporte al panel de un negocio es de solo lectura y queda registrado.</li>
        </ul>
      </Section>

      <Section title="7. Cookies y almacenamiento del navegador">
        <p>Usamos una cookie para mantener tu sesión iniciada y el almacenamiento del navegador para recordar tus preferencias (tema claro u oscuro, sucursal y tamaño de papel del ticket) y la sesión del portal. No usamos cookies de publicidad ni de seguimiento.</p>
      </Section>

      <Section title="8. Tus derechos">
        <p>Puedes pedir acceso a tus datos, que se corrijan, que se eliminen, u oponerte a que se sigan usando.</p>
        <ul>
          <li>
            <b className="font-semibold text-ink">Clientes de una lavandería:</b> pídeselo a tu lavandería, en el local o desde la sección "Ayuda" del portal. Tu nombre y dirección los puedes corregir tú mismo en "Mis datos".
          </li>
          <li>
            <b className="font-semibold text-ink">Dueños y equipo:</b> escríbenos desde "Ayuda y soporte" dentro del sistema.
          </li>
        </ul>
        <p>Si consideras que tu pedido no fue atendido, puedes acudir a la Autoridad Nacional de Protección de Datos Personales.</p>
      </Section>

      <Section title="9. Cambios">
        <p>Si cambiamos esta política, publicaremos la nueva versión aquí con su fecha.</p>
      </Section>
    </LegalLayout>
  )
}
