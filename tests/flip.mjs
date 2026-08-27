// The card-move animation must fire for real moves and stay silent otherwise.
// Regression: FLIP used to measure getBoundingClientRect(), which counts the
// card-in entry transform, so the first tap on any card jolted the whole list.
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 384, height: 832 } })
const fail = (m) => { console.log('FAIL:', m); process.exitCode = 1 }

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  const base = { brand: 'Nissan', vin: '1111', regNumber: 'AAA111', manager: 'M', salon: 'L1',
    techSheet: 'needed', notes: '', reservedAt: '', fleet: false, vehicleCount: 1, fleetVehicles: [],
    completed: false, regitraAt: null, pickupAt: null, completedAt: null,
    stage: 'take', caseType: 'registracija', date: '2026-08-24' }
  localStorage.setItem('registracijos-bylos:v1', JSON.stringify(
    ['Qashqai', 'Juke', 'Leaf'].map((model, i) => ({ ...base, id: `c${i}`, model, createdAt: i })),
  ))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)

const watch = () => page.evaluate(() => {
  window.__moves = []
  const orig = Element.prototype.animate
  Element.prototype.animate = function (kf, opts) {
    if (this.hasAttribute?.('data-flip-id')) window.__moves.push(this.dataset.flipId)
    return orig.call(this, kf, opts)
  }
})
const moves = () => page.evaluate(() => window.__moves)
const cardTop = () => page.evaluate(() => Math.round(document.querySelector('.case-card').getBoundingClientRect().top))

// --- toggling the tech sheet moves nothing, so nothing may animate ---
await watch()
const before = await cardTop()
await page.locator('.case-card').first().locator('.doc-btn').click()
await page.waitForTimeout(500)
if ((await moves()).length !== 0) fail('tech sheet toggle animated cards: ' + (await moves()).join(','))
if ((await cardTop()) !== before) fail('the list shifted while toggling the tech sheet')

// --- expanding a card must not fling its neighbours either ---
await watch()
await page.locator('.case-card').first().locator('.case-row').click()
await page.waitForTimeout(500)
let m = await moves()
if (m.includes('c0')) fail('the expanded card animated itself')
await page.locator('.case-card').first().locator('.case-row').click()
await page.waitForTimeout(500)

// --- but a real section change still animates the card that moved ---
await watch()
const row = ".case-card:has-text('Qashqai') .case-row"
const b = await page.locator(row).boundingBox()
const x = b.x + b.width / 2, y = b.y + b.height / 2
await page.mouse.move(x, y)
await page.mouse.down()
for (let i = 1; i <= 8; i++) await page.mouse.move(x + (130 * i) / 8, y, { steps: 2 })
await page.waitForTimeout(700)
await page.mouse.up()
await page.waitForTimeout(600)
m = await moves()
if (!m.length) fail('moving a card between sections did not animate')

console.log(process.exitCode ? 'FLIP: FAILURES' : 'FLIP: ALL PASS')
await browser.close()
