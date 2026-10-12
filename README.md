# uLaundry Web

Frontend de uLaundry (Unify Tec), el sistema para lavanderías en Perú.
React 19 · Vite · TypeScript · Tailwind v4 · Radix · TanStack Query.

```bash
pnpm install
pnpm dev        # http://localhost:5273 (las llamadas a /api van a http://localhost:4100)
pnpm test       # unitarios
pnpm lint
pnpm build
```

Necesita la API corriendo. Sin MongoDB instalado: `pnpm --dir ../uLaundry-api dev:memory`.

## Qué incluye

| Para quién | Pantallas |
| --- | --- |
| Lavandería | Inicio, Órdenes, Nueva orden, ficha y ticket de la orden, Domicilio, Caja del día, Pagos, Clientes, Consultas, Servicios, Promociones, Reportes, Sucursales, Equipo y roles, Auditoría, Configuración, Soporte |
| Cliente de la lavandería | Portal en `/portal/:slug`: entra con su celular y un código por WhatsApp; ve sus órdenes, saldo y pagos, pide recojo y escribe consultas |
| Unify Tec | Panel de plataforma en `/superadmin`: negocios, pagos de suscripción, planes, soporte y equipo |
| Público | Landing (`/` sin sesión, `/inicio` siempre), registro, términos (`/terminos`) y privacidad (`/privacidad`) |

`/registro?plan=pro` preselecciona el plan. La prueba gratis es en el plan que el negocio elige.

## Entorno de pruebas

Para probar sin tocar la base ni los puertos de desarrollo, levanta una segunda web contra una API en memoria:

```bash
# En la API: base en memoria, sin modo watch, en otro puerto
PORT=3200 pnpm --dir ../uLaundry-api dev:memory --once
# Aquí: la web de pruebas apunta a esa API
API_TARGET=http://localhost:3200 pnpm dev --port 5280
# Datos de ejemplo (solo acepta la API del puerto 3200)
node ../uLaundry-api/scripts/seed-pruebas.mjs ../.claude/launch.json
```

Sin proveedor de correo ni de WhatsApp configurado, los mensajes (invitaciones, enlaces para cambiar la
contraseña, códigos del portal, avisos de la orden) salen en la consola de la API.

### Capturas de la landing

Las imágenes de `public/landing/` son capturas reales de la app con datos de ejemplo. Para regenerarlas,
con el entorno de pruebas levantado y sembrado:

```bash
pnpm capturas
```

Usa Chrome instalado (`CHROME_PATH` para otra ruta) y pide el código del portal, que sale en la consola de la API.

## Despliegue en Vercel

1. Importa el repo en Vercel. Toma la configuración de `vercel.json`
   (Vite, pnpm, salida `dist`, rutas de la SPA y caché de `/assets`).
2. En **Settings → Environment Variables** agrega `VITE_API_URL` con la URL pública de la API
   (con o sin `/api` al final). Es de compilación: si la cambias, vuelve a desplegar.
3. En la API configura:
   - `CORS_ORIGIN`: el dominio de la web (varios separados por coma, p. ej. el de producción y el `*.vercel.app`).
   - `APP_URL`: el dominio de la web, para los enlaces de los correos y de los avisos de WhatsApp.
   - `COOKIE_SAMESITE`: `lax` si web y API comparten dominio (`app.tudominio.com` + `api.tudominio.com`),
     `none` si están en dominios distintos (`*.vercel.app` + `*.onrender.com`).

Recomendado: dominios propios del mismo sitio. Con dominios distintos la sesión depende de cookies de
terceros, que Safari (iPhone/Mac) bloquea por defecto: ahí habría que iniciar sesión en cada recarga.

## Sesión y permisos

- El access token vive solo en memoria; la sesión se renueva con una cookie httpOnly (`lib/api/client.ts`).
- `useAuth()` expone la sesión; `useAccess()` responde "¿puede?" según rol y plan.
- El menú (`components/layout/nav.ts`) declara qué permiso y qué funcionalidad del plan necesita cada pantalla;
  el mismo dato protege la ruta (`app/guards.tsx`).
- "Ver como el negocio" (modo soporte) usa un token de solo lectura de 30 minutos que no se guarda:
  al recargar la página se vuelve al panel de plataforma.
- El portal del cliente tiene su propia sesión, por negocio, guardada en el navegador (`features/portal/api.ts`).

## Estructura

```
scripts/                capturas de la landing
public/landing/         capturas reales usadas en la landing
src/
  styles/tokens.css     tokens de diseño (claro y oscuro)
  index.css             Tailwind + mapeo de tokens a utilidades (bg-surface, text-muted, bg-grad…)
  lib/                  cliente de la API, sesión, formatos (es-PE, soles), fechas (America/Lima), tema
  components/ui/        componentes base (botones, campos, tablas, diálogos, confirmación)
  components/layout/    menú lateral, encabezado, navegación
  components/brand/     logo
  features/<módulo>/    pantallas; cada módulo trae su api.ts con tipos y consultas
  app/                  router y guards
```

## Reglas

- Colores solo con tokens (`bg-surface`, `text-ink-2`, `border-line`…), nunca hex sueltos:
  así el modo oscuro funciona sin trabajo extra.
- `teal*` es el color de acción (petróleo) y `pop*` el de atención (coral). Texto de acción → `text-teal-ink`.
- Crear y editar entidades principales va en página propia, no en paneles laterales.
- Para confirmar una acción usa `useConfirm()` (`components/ui/confirm.tsx`), no `window.confirm`.
- Botones de ícono siempre con `aria-label`.
- Los montos viajan en céntimos y se muestran con `formatCents()`, nunca a mano.
- Si una función aparece en la landing o en la lista de planes, tiene que existir de verdad.
