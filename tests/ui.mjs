// The header summary, the sticky section titles and the manager filter.
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 860 } })
const fail = (m) => { console.log('FAIL:', m); process.exitCode = 1 }

const BASE = {
  brand: 'Nissan', vin: '1111', regNumber: 'AAA111', manager: 'Mantas J.', salon: 'L1',
  techSheet: 'none', notes: '', reservedAt: '', fleet: false, vehicleCount: 1, fleetVehicles: [],
  completed: false, regitraAt: null, pickupAt: null, completedAt: null,
  stage: 'take', caseType: 'registracija', date: '2026-08-24',
}
const seed = (list) => page.evaluate(({ base, list }) => {
  localStorage.setItem('registracijos-bylos:v1', JSON.stringify(list.map((c, i) => ({ ...base, createdAt: i, ...c }))))
  localStorage.setItem('rb:todos', JSON.stringify([{ id: 't1', text: 'Rakto geležtė', done: false }]))
}, { base: BASE, list })
const iso = (off) => {
  const d = new Date(Date.now() + off * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })

// ---------- the header carries two numbers at most, on one line ----------
await seed([
  { id: 'a', model: 'Vezama', reservedAt: iso(0) },
  { id: 'b', model: 'Regitroj', stage: 'regitra', regitraAt: Date.now() },
  { id: 'c', model: 'Paimti', stage: 'pickup', pickupAt: Date.now() },
  { id: 'd', model: 'Apziura', caseType: 'apziura' },
  { id: 'e', model: 'Tapatybe', caseType: 'tapatybe' },
  { id: 'f', model: 'Fleetas', fleet: true, vehicleCount: 5, fleetVehicles: [{ model: 'C3', count: 5 }] },
])
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)

const items = await page.locator('.hc-item').count()
if (items !== 2) fail(`the header should hold the car total and the deadline only, got ${items}`)
// five single cases + a fleet of five = ten vehicles, not six cases
if ((await page.locator('.hc-item.c-take strong').textContent()) !== '10')
  fail('the car count must count vehicles, fleets included')
if ((await page.locator('.hc-item.c-due strong').textContent()) !== '1') fail('deadline count wrong')

const headerLines = await page.locator('.app-header').evaluate((el) => el.offsetHeight)
if (headerLines > 70) fail(`the header grew past one line of counts: ${headerLines}px`)

// ---------- section titles stick under the header ----------
const capBox = await page.locator('.sticky-cap').first().evaluate((el) => ({
  position: getComputedStyle(el).position,
  top: getComputedStyle(el).top,
}))
if (capBox.position !== 'sticky') fail(`section title is not sticky: ${capBox.position}`)
if (parseFloat(capBox.top) < 40) fail(`sticky title would hide under the header: top ${capBox.top}`)

await page.evaluate(() => window.scrollTo(0, 400))
await page.waitForTimeout(400)
const stuck = await page.locator('.sticky-cap').first().evaluate((el) => el.getBoundingClientRect().top)
const headerBottom = await page.locator('.app-header').evaluate((el) => el.getBoundingClientRect().bottom)
if (Math.abs(stuck - headerBottom) > 3)
  fail(`a scrolled-past title should park on the header edge: ${stuck} vs ${headerBottom}`)
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(300)

// ---------- the manager filter ----------
await seed([
  { id: 'm1', model: 'Mantui', manager: 'Mantas J.' },
  { id: 'm2', model: 'Rokui', manager: 'Rokas V.' },
  { id: 'm3', model: 'RokuiIrgi', manager: 'Rokas V.', stage: 'regitra', regitraAt: Date.now() },
])
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)

if ((await page.locator('.manager-link').count()) !== 3) fail('every card should offer its manager as a filter')
await page.locator(".case-card:has-text('Rokui') .manager-link").first().click()
await page.waitForTimeout(500)

let models = await page.locator('.case-model').allTextContents()
if (models.length !== 2 || !models.every((m) => m.startsWith('Rokui')))
  fail('filter did not narrow to one manager: ' + models.join(','))
if ((await page.locator('.header-manager').textContent()) !== 'Rokas V.')
  fail('the header should name the manager being shown')
if (await page.locator('.day-tasks').count()) fail('day tasks are not a manager\'s, so they stay out of a filtered list')
if (await page.locator('.manager-link').count()) fail('no point offering the filter that is already on')

// the phone back button peels the filter off before leaving the app
await page.goBack()
await page.waitForTimeout(500)
models = await page.locator('.case-model').allTextContents()
if (models.length !== 3) fail('back should clear the manager filter: ' + models.join(','))
if (await page.locator('.header-manager').count()) fail('header still filtered after back')

// and so does the button in the header
await page.locator(".case-card:has-text('Mantui') .manager-link").first().click()
await page.waitForTimeout(400)
await page.click("button[aria-label='Rodyti visų vadybininkų bylas']")
await page.waitForTimeout(400)
if ((await page.locator('.case-model').count()) !== 3) fail('the header back button did not clear the filter')

// ---------- the archive counts one manager's work ----------
await seed([
  { id: 'q1', model: 'Viena', completed: true, completedAt: Date.now() },
  { id: 'q2', model: 'Fleetas', fleet: true, vehicleCount: 5, fleetVehicles: [{ model: 'Juke', count: 5 }], completed: true, completedAt: Date.now() },
  { id: 'q3', model: 'Rokui', manager: 'Rokas V.', fleet: true, vehicleCount: 3, fleetVehicles: [{ model: 'Kona', count: 3 }], completed: true, completedAt: Date.now() },
])
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.click("button[aria-label='Archyvas']")
await page.waitForTimeout(500)

let stats = await page.locator('.list-caption').first().textContent()
if (!stats.includes('3 bylos') || !stats.includes('9 automobiliai'))
  fail('archive totals wrong before filtering: ' + stats)

await page.locator(".case-card:has-text('Fleetas') .manager-link").first().click()
await page.waitForTimeout(600)
stats = await page.locator('.list-caption').first().textContent()
// Mantas keeps a plain case and a fleet of five: two cases, six cars
if (!stats.includes('2 bylos') || !stats.includes('6 automobiliai'))
  fail("the archive should count only the picked manager's work: " + stats)
if (!(await page.locator('.section-hint').textContent()).includes('6 automobiliai'))
  fail('the month line should be scoped to the manager too')
if ((await page.locator('.header-manager').textContent()) !== 'Mantas J.')
  fail('the archive header should name the manager')
if (await page.locator("button[aria-label='Grįžti į aktyvias bylas']").count())
  fail('in the archive the arrow should clear the filter first, not leave the archive')

// clearing drops back to the whole archive, not to the active list
await page.click("button[aria-label='Rodyti visų vadybininkų bylas']")
await page.waitForTimeout(500)
stats = await page.locator('.list-caption').first().textContent()
if (!stats.includes('3 bylos')) fail('clearing the filter should restore the archive totals: ' + stats)
if (!(await page.locator("button[aria-label='Grįžti į aktyvias bylas']").count()))
  fail('the archive arrow should be back once nothing is filtered')

console.log(process.exitCode ? 'UI: FAILURES' : 'UI: ALL PASS')
await browser.close()
