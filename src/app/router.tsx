import type { ReactNode } from 'react'
import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { NAV_ITEMS } from '@/components/layout/nav'
import { AuditPage } from '@/features/audit/audit-page'
import { CashPage } from '@/features/cash/cash-page'
import { HomePage } from '@/features/home/home-page'
import { DeliveriesPage } from '@/features/orders/deliveries-page'
import { OrderFormPage } from '@/features/orders/order-form-page'
import { OrderPage } from '@/features/orders/order-page'
import { OrdersPage } from '@/features/orders/orders-page'
import { TicketPage as OrderTicketPage } from '@/features/orders/ticket-page'
import { PaymentsPage } from '@/features/payments/payments-page'
import { PortalPage } from '@/features/portal/portal-page'
import { PromotionFormPage } from '@/features/promotions/promotion-form-page'
import { PromotionsPage } from '@/features/promotions/promotions-page'
import { ReportsPage } from '@/features/reports/reports-page'
import { ServiceFormPage } from '@/features/services/service-form-page'
import { ServicesPage } from '@/features/services/services-page'
import { LandingPage } from '@/features/landing/landing-page'
import { PrivacyPage, TermsPage } from '@/features/legal/legal-pages'
import { LoginPage } from '@/features/auth/login-page'
import { NewOrganizationPage, OrganizationsPage } from '@/features/auth/organizations-page'
import { ForgotPasswordPage, ResetPasswordPage } from '@/features/auth/password-reset-pages'
import { RegisterPage } from '@/features/auth/register-page'
import { ClientDetailPage } from '@/features/clients/client-detail-page'
import { ClientsPage } from '@/features/clients/clients-page'
import { NewClientPage } from '@/features/clients/new-client-page'
import { BranchFormPage } from '@/features/branches/branch-form-page'
import { BranchesPage } from '@/features/branches/branches-page'
import { OrganizationDetailPage } from '@/features/platform/organization-detail-page'
import { NotFound } from '@/features/not-found/not-found'
import { PlansPage } from '@/features/platform/plans-page'
import { SuperadminPage } from '@/features/platform/superadmin-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { AcceptInvitationPage } from '@/features/team/accept-invitation-page'
import { InvitePage } from '@/features/team/invite-page'
import { MemberPage } from '@/features/team/member-page'
import { RoleFormPage, RolesPage } from '@/features/team/roles-pages'
import { TeamPage } from '@/features/team/team-page'
import { InquiriesPage } from '@/features/support/inquiries-page'
import { InquiryPage } from '@/features/support/inquiry-page'
import { NewTicketPage } from '@/features/support/new-ticket-page'
import { PlatformSupportPage } from '@/features/support/platform-support-page'
import { PlatformTeamPage } from '@/features/support/platform-team-page'
import { PlatformTicketPage } from '@/features/support/platform-ticket-page'
import { SupportPage } from '@/features/support/support-page'
import { TicketPage } from '@/features/support/ticket-page'
import { AppGate, PublicOnly, RequireSession, ScreenGate } from './guards'

const SCREENS: Record<string, () => ReactNode> = {
  '/': () => <HomePage />,
  '/ordenes': () => <OrdersPage />,
  '/ordenes/nueva': () => <OrderFormPage />,
  '/caja': () => <CashPage />,
  '/pagos': () => <PaymentsPage />,
  '/domicilio': () => <DeliveriesPage />,
  '/promociones': () => <PromotionsPage />,
  '/reportes': () => <ReportsPage />,
  '/auditoria': () => <AuditPage />,
  '/servicios': () => <ServicesPage />,
  '/superadmin': () => <SuperadminPage />,
  '/superadmin/planes': () => <PlansPage />,
  '/superadmin/soporte': () => <PlatformSupportPage />,
  '/superadmin/equipo': () => <PlatformTeamPage />,
  '/soporte': () => <SupportPage />,
  '/consultas': () => <InquiriesPage />,
  '/clientes': () => <ClientsPage />,
  '/configuracion': () => <SettingsPage />,
  '/equipo': () => <TeamPage />,
  '/sucursales': () => <BranchesPage />,
}

/** Páginas hijas: heredan el permiso del ítem del menú padre. */
const DETAIL_ROUTES: Array<[path: string, parent: string, element: ReactNode]> = [
  ['/ordenes/:id', '/ordenes', <OrderPage />],
  ['/ordenes/:id/editar', '/ordenes', <OrderFormPage />],
  ['/servicios/:id', '/servicios', <ServiceFormPage />],
  ['/clientes/nuevo', '/clientes', <NewClientPage />],
  ['/clientes/:id', '/clientes', <ClientDetailPage />],
  ['/promociones/:id', '/promociones', <PromotionFormPage />],
  ['/equipo/invitar', '/equipo', <InvitePage />],
  ['/equipo/roles', '/equipo', <RolesPage />],
  ['/equipo/roles/:id', '/equipo', <RoleFormPage />],
  ['/sucursales/:id', '/sucursales', <BranchFormPage />],
  ['/superadmin/negocios/:id', '/superadmin', <OrganizationDetailPage />],
  ['/equipo/:id', '/equipo', <MemberPage />],
  ['/soporte/nuevo', '/soporte', <NewTicketPage />],
  ['/consultas/:id', '/consultas', <InquiryPage />],
  ['/soporte/:id', '/soporte', <TicketPage />],
  ['/superadmin/soporte/:id', '/superadmin/soporte', <PlatformTicketPage />],
]

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/olvide-contrasena', element: <ForgotPasswordPage /> },
    ],
  },
  // El registro maneja su propia redirección para poder mostrar el paso "Listo".
  { path: '/registro', element: <RegisterPage /> },
  // Pública: funciona con o sin sesión iniciada.
  { path: '/invitacion/:token', element: <AcceptInvitationPage /> },
  // Landing siempre visible, también con sesión (en "/" solo se ve sin sesión).
  { path: '/inicio', element: <LandingPage /> },
  { path: '/terminos', element: <TermsPage /> },
  { path: '/privacidad', element: <PrivacyPage /> },
  // Portal del cliente final (sin cuenta de uLaundry).
  { path: '/portal/:slug', element: <PortalPage /> },
  // Funciona con o sin sesión: el enlace llega por correo.
  { path: '/restablecer/:token', element: <ResetPasswordPage /> },
  {
    element: <RequireSession />,
    children: [
      { path: '/negocios', element: <OrganizationsPage /> },
      { path: '/negocios/nuevo', element: <NewOrganizationPage /> },
      // Ticket imprimible: fuera del panel, sin menú ni encabezado.
      { path: '/ordenes/:id/ticket', element: <OrderTicketPage /> },
      {
        element: (
          <AppGate>
            <AppShell />
          </AppGate>
        ),
        children: [
          ...NAV_ITEMS.map((item) => ({
            path: item.path,
            element: <ScreenGate path={item.path}>{SCREENS[item.path]?.() ?? <NotFound />}</ScreenGate>,
          })),
          ...DETAIL_ROUTES.map(([path, parent, element]) => ({
            path,
            element: <ScreenGate path={parent}>{element}</ScreenGate>,
          })),
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])
