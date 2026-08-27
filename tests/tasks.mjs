import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 384, height: 832 } })
const fail = (m) => { console.log('FAIL:', m); process.exitCode = 1 }

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  const base = {
    brand: 'Nissan', vin: '3129', regNumber: '', manager: 'Kasparas', salon: 'L1',
    techSheet: 'none', notes: '', reservedAt: '', fleet: false, vehicleCount: 1, fleetVehicles: [],
    tasks: [], completed: false, regitraAt: null, pickupAt: null, completedAt: null,
    stage: 'take', date: '2026-08-24',
  }
  localStorage.setItem('registracijos-bylos:v1', JSON.stringify([
    { ...base, id: 't1', model: 'Qashqai', createdAt: 1, caseType: 'tapatybe' },
  ]))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const card = page.locator(".case-card:has-text('Qashqai')")
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('registracijos-bylos:v1'))[0])
// the card keeps its expanded state across edits, so toggle only when needed
const isOpen = () => card.locator('.notes-wrap.open').count().then((n) => n > 0)
const expand = async () => { if (!(await isOpen())) { await card.locator('.case-row').click(); await page.waitForTimeout(400) } }
const collapse = async () => { if (await isOpen()) { await card.locator('.case-row').click(); await page.waitForTimeout(400) } }

// --- 1. the tech sheet button is on an identity case too ---
if (!(await card.locator('.doc-btn').count())) fail('tech sheet button missing on an identity case')
if (!(await card.locator('.doc-btn').isDisabled())) fail('a "not needed" sheet should stay untappable on the card')

// the form offers the selector for every case type
await expand()
await card.locator("button:has-text('Redaguoti')").click()
await page.waitForTimeout(400)
if (!(await page.locator(".field-label:has-text('Techninis lapas')").count())) fail('tech sheet field hidden for identity case')
await page.click('.segmented button:text-is("Reikia")')
await page.click(".case-form button:has-text('Išsaugoti')")
await page.waitForTimeout(600)
if ((await stored()).techSheet !== 'needed') fail('tech sheet not saved on an identity case')
// and now it toggles from the card, like a registration
await card.locator('.doc-btn').click()
await page.waitForTimeout(300)
if ((await stored()).techSheet !== 'have') fail('tech sheet did not toggle from the card')

// --- 2. tasks: added from the expanded panel ---
await expand()
await card.locator("input[aria-label='Naujas darbas']").fill('Išpjauti naują rakto geležtę')
await card.locator("button[aria-label='Pridėti darbą prie bylos']").click()
await page.waitForTimeout(300)
await card.locator("input[aria-label='Naujas darbas']").fill('Paskambinti klientui')
await card.locator("input[aria-label='Naujas darbas']").press('Enter')
await page.waitForTimeout(300)
let st = await stored()
if (st.tasks.length !== 2) fail(`tasks not stored: ${JSON.stringify(st.tasks)}`)
if (st.tasks[0].text !== 'Išpjauti naują rakto geležtę') fail('task text wrong')

// --- 3. pending tasks show on the collapsed card ---
await collapse()
const strips = await card.locator('.task-strip-text').allTextContents()
if (strips.length !== 2) fail('pending tasks not shown on the card: ' + strips.join(' | '))
if (!strips.includes('Išpjauti naują rakto geležtę')) fail('task missing from the card: ' + strips.join(' | '))

// ticking one on the card removes it from view but keeps it on the case
await card.locator('.task-strip .task-check').first().click()
await page.waitForTimeout(400)
st = await stored()
if (!st.tasks[0].done) fail('tapping the card checkbox did not complete the task')
if (st.tasks.length !== 2) fail('completing a task must not delete it')
if ((await card.locator('.task-strip').count()) !== 1) fail('done task should leave the collapsed card')
if ((await page.locator('.notes-wrap.open').count()) !== 0) fail('ticking a task should not expand the card')

// --- 4. done tasks are still listed inside, and can be removed ---
await expand()
if ((await card.locator('.task-item').count()) !== 2) fail('expanded panel should list every task')
if (!(await card.locator('.task-item.done').count())) fail('done task not marked in the panel')
await card.locator("button[aria-label='Pašalinti darbą']").first().click()
await page.waitForTimeout(300)
if ((await stored()).tasks.length !== 1) fail('task delete failed')

// --- 5. tasks survive editing the case ---
await expand()
await card.locator("button:has-text('Redaguoti')").click()
await page.waitForTimeout(400)
await page.fill('#f-manager', 'Kasparas B.')
await page.click(".case-form button:has-text('Išsaugoti')")
await page.waitForTimeout(600)
st = await stored()
if (st.manager !== 'Kasparas B.') fail('edit did not save')
if (st.tasks.length !== 1) fail('editing a case wiped its tasks')

console.log(process.exitCode ? 'TASKS: FAILURES' : 'TASKS: ALL PASS')
await browser.close()
