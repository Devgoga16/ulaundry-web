// Regenera las capturas reales de la landing (public/landing/*.webp).
//
// SOLO contra el entorno de pruebas: web en 5280 → API en 3200 con base en memoria,
// ya sembrada con scripts/seed-pruebas.mjs del repo de la API. Nunca contra datos reales.
//
// Uso:  pnpm capturas [ruta a launch.json] [carpeta de salida]
// Al llegar al portal pide el código de 6 dígitos: sale en la consola de la API de pruebas.
// CHROME_PATH indica otro navegador basado en Chromium si no usas la ruta por defecto.
import { readFileSync, mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import puppeteer from 'puppeteer-core'

const WEB = 'http://localhost:5280'
const API = 'http://localhost:3200/api'
const [launchPath = '../.claude/launch.json', outDir = 'public/landing'] = process.argv.slice(2)
const launch = JSON.parse(readFileSync(launchPath, 'utf8'))
const password = launch.configurations.find((c) => c.name === 'ulaundry-api-test').env.SUPERADMIN_PASSWORD
const email = 'rosa@pruebas.test'
mkdirSync(outDir, { recursive: true })

async function call(path, { token, body, method } = {}) {
  const res = await fetch(API + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json)}`)
  return json
}

// ---------- Más datos de ejemplo para que las pantallas se vean en uso ----------
const { accessToken: token } = await call('/auth/login', { body: { email, password } })
const [branch] = await call('/branches', { token })
const services = await call('/services', { token })
const svc = (name) => services.find((s) => s.name.startsWith(name)).id
const existing = await call('/orders?limit=100', { token })
if (existing.total < 12) {
  const people = [
    ['Mariela', 'Chávez', '961222333'],
    ['Hotel', 'Bahía', '014445566'.replace(/^0/, '9').slice(0, 9)],
    ['Renzo', 'Gutiérrez', '977333111'],
    ['Patricia', 'León', '988777666'],
    ['Diego', 'Flores', '966555444'],
  ]
  const ids = []
  for (const [firstName, lastName, phone] of people) ids.push((await call('/clients', { token, body: { firstName, lastName, phone } })).id)
  const order = (clientId, items, extra = {}) => call('/orders', { token, body: { branchId: branch.id, clientId, items, ...extra } })
  const status = (id, s, location) => call(`/orders/${id}/status`, { token, body: { status: s, ...(location && { location }) } })
  const a = await order(ids[0], [{ serviceId: svc('Lavado por kilo'), quantity: 9 }], { advance: { amount: 3600, method: 'yape', reference: 'OP-8812' } })
  await status(a.id, 'ready', 'A-07')
  const b = await order(ids[1], [{ serviceId: svc('Lavado y planchado'), quantity: 22, notes: 'Sábanas y toallas' }], { advance: { amount: 7000, method: 'transfer', reference: 'TR-2231' } })
  await status(b.id, 'in_process')
  await order(ids[2], [{ serviceId: svc('Camisa'), quantity: 6 }, { serviceId: svc('Edredón'), quantity: 1 }], { express: true, advance: { amount: 3000, method: 'cash' } })
  const d = await order(ids[3], [{ serviceId: svc('Cortina'), quantity: 4 }], { observations: 'Un paño con quemadura de sol en el borde.' })
  await status(d.id, 'ready', 'C-02')
  const e = await order(ids[4], [{ serviceId: svc('Lavado por kilo'), quantity: 4.5 }], { advance: { amount: 1800, method: 'plin' } })
  await status(e.id, 'ready', 'B-03')
  await call(`/orders/${e.id}/deliver`, { token, body: {} })
}
const orders = (await call('/orders?limit=100', { token })).items
const readyWithBalance = orders.find((o) => o.status === 'ready' && o.balance > 0 && !o.dropoff)
const portalClient = orders.find((o) => o.ticket === 'M-00001')
const formClient = orders.find((o) => o.clientName.startsWith('Lucía'))

// ---------- Navegador ----------
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--hide-scrollbars'] })

async function shoot(page, name, { clip, fullPage = false } = {}) {
  await new Promise((r) => setTimeout(r, 700))
  await page.screenshot({ path: `${outDir}/${name}.webp`, type: 'webp', quality: 88, ...(clip && { clip }), fullPage })
  console.log('✓', name)
}

async function staff(theme, width, height) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1.5 })
  await page.evaluateOnNewDocument((t) => localStorage.setItem('ulaundry-theme', t), theme)
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle0' })
  await page.type('input[type=email]', email)
  await page.type('input[type=password]', password)
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type=submit]')])
  return { ctx, page }
}

for (const theme of ['light', 'dark']) {
  const s = theme === 'light' ? '' : '-dark'
  const { ctx, page } = await staff(theme, 1360, 860)
  const go = async (path) => {
    // Navegación dentro de la app (sin recargar): conserva la sesión en memoria.
    await page.evaluate((p) => {
      history.pushState({}, '', p)
      dispatchEvent(new PopStateEvent('popstate'))
    }, path)
    await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => {})
  }
  await go('/ordenes')
  await shoot(page, `ordenes${s}`)
  await go(`/ordenes/${readyWithBalance.id}`)
  await shoot(page, `orden${s}`)
  // Nueva orden con el formulario lleno: cliente elegido, un servicio y una observación.
  await go(`/ordenes/nueva?cliente=${formClient.clientId}`)
  await page.waitForSelector('main select')
  const option = await page.$$eval('main select option', (os) => os.find((o) => o.textContent.startsWith('Lavado y planchado'))?.value)
  await page.select('main select', option)
  await page.type('input[placeholder="0.0"]', '6.5')
  await page.type('textarea', 'Mancha de café en blusa blanca.')
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    scrollTo(0, 0)
  })
  await shoot(page, `nueva-orden${s}`)
  await go('/caja')
  await shoot(page, `caja${s}`)
  await go('/reportes')
  await shoot(page, `reportes${s}`)
  await go('/domicilio')
  await shoot(page, `domicilio${s}`)
  await go('/')
  await shoot(page, `inicio${s}`)

  // Ticket: solo el papel.
  await go(`/ordenes/${readyWithBalance.id}/ticket`)
  const ticket = await page.$('article')
  await new Promise((r) => setTimeout(r, 600))
  await ticket.screenshot({ path: `${outDir}/ticket.webp`, type: 'webp', quality: 92 })
  console.log('✓ ticket')
  await ctx.close()

  // Panel en el celular.
  const m = await staff(theme, 390, 800)
  await m.page.evaluate((p) => {
    history.pushState({}, '', p)
    dispatchEvent(new PopStateEvent('popstate'))
  }, `/ordenes/${readyWithBalance.id}`)
  await m.page.waitForNetworkIdle({ idleTime: 500 }).catch(() => {})
  await shoot(m.page, `orden-movil${s}`)
  await m.ctx.close()
}

// ---------- Portal del cliente (celular) ----------
{
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 2 })
  await page.evaluateOnNewDocument(() => localStorage.getItem('ulaundry-theme') ?? localStorage.setItem('ulaundry-theme', 'light'))
  await page.goto(`${WEB}/portal/lavanderia-burbujas`, { waitUntil: 'networkidle0' })
  await shoot(page, 'portal-ingreso')
  await page.type('input[type=tel]', portalClient.clientPhone.replace('+51', ''))
  await page.click('button[type=submit]')
  await page.waitForSelector('input[autocomplete="one-time-code"]')
  // El código de un solo uso sale en la consola de la API de pruebas.
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const code = (await rl.question('Código del portal (6 dígitos, en la consola de la API de pruebas): ')).trim()
  rl.close()
  if (!/^\d{6}$/.test(code)) throw new Error('No llegó el código del portal')
  await page.type('input[autocomplete="one-time-code"]', code)
  await page.click('button[type=submit]')
  await page.waitForSelector('nav[aria-label="Secciones del portal"]')
  await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => {})
  await shoot(page, 'portal')
  await page.evaluate(() => localStorage.setItem('ulaundry-theme', 'dark'))
  await page.reload({ waitUntil: 'networkidle0' })
  await shoot(page, 'portal-dark')
  await ctx.close()
}

await browser.close()
