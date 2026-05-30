import { chromium } from 'playwright-core'

const URL = process.env.URL || 'http://localhost:4173/'
const errors = []
const logs = []

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || chromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))

async function shot(name) {
  await page.screenshot({ path: `/tmp/shot-${name}.png` })
}

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  console.log('TITLE:', await page.title())
  await shot('1-home')

  // Eléctrico está activo por defecto; abrir Equipos (ELE)
  await page.getByText('Equipos (ELE)', { exact: false }).first().click()
  await page.waitForTimeout(500)
  await shot('2-grid')
  console.log('grid rows:', await page.locator('table tbody tr').count())

  // abrir ficha (doble clic en una fila)
  const firstRow = page.locator('table tbody tr').first()
  await firstRow.dblclick()
  await page.waitForTimeout(400)
  console.log('ficha visible:', await page.getByText('Ficha de elemento').isVisible().catch(() => false))
  await shot('3-ficha')
  await page.locator('aside button', { hasText: 'Cancelar' }).first().click().catch(() => {})
  await page.waitForTimeout(300)

  const tab = (name) => page.locator('button', { hasText: new RegExp(`^${name}$`) }).first()
  await tab('Fichas').click()
  await page.waitForTimeout(500)
  console.log('cards:', await page.locator('text=Editar ficha').count().catch(() => 0))
  await shot('4-fichas')

  await tab('3D').click()
  await page.waitForTimeout(2000)
  console.log('canvas present:', await page.locator('canvas').count())
  console.log('3D toolbar (Planta):', await page.getByText('Planta', { exact: true }).isVisible().catch(() => false))
  await shot('6-3d')

  // probar herramientas 3D: secciones, AWP, 4D
  await page.getByTitle('Planos de corte').click().catch(() => {})
  await page.getByTitle(/Filtro visual AWP/).click().catch(() => {})
  await page.getByTitle(/Simulación de construcción 4D/).click().catch(() => {})
  await page.waitForTimeout(600)
  await shot('6b-3d-tools')

  await tab('Split').click()
  await page.waitForTimeout(1500)
  console.log('split canvas:', await page.locator('canvas').count(), 'split table:', await page.locator('table').count())
  await shot('5-split')

  await page.getByRole('button', { name: 'Cambiar tema' }).click()
  await page.waitForTimeout(500)
  await shot('7-dark')
} catch (e) {
  errors.push('SCRIPT: ' + String(e))
} finally {
  console.log('--- PAGE ERRORS ---')
  console.log(errors.length ? errors.join('\n') : 'none')
  console.log('--- CONSOLE ERRORS ---')
  console.log(logs.length ? logs.slice(0, 20).join('\n') : 'none')
  await browser.close()
}
