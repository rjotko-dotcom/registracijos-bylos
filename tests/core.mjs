// Core regression: the flows that must never break.
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 384, height: 832 } })
const fail = (m) => { console.log('FAIL:', m); process.exitCode = 1 }

const BASE = {
  brand: 'Nissan', vin: '1111', regNumber: 'AAA111', manager: 'Mantas J.', salon: 'L1',
  techSheet: 'none', notes: '', reservedAt: '', fleet: false, vehicleCount: 1, fleetVehicles: [],
  completed: false, regitraAt: null, pickupAt: null, completedAt: null,
  stage: 'take', caseType: 'registracija', date: '2026-08-24',
}
const seed = (list) => page.evaluate(({ base, list }) => {
  localStorage.setItem('registracijos-bylos:v1', JSON.stringify(list.map((c, i) => ({ ...base, createdAt: i, ...c }))))
}, { base: BASE, list })
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('registracijos-bylos:v1')))
const caps = async () => (await page.locator('.list-caption').allTextContents()).map((c) => c.trim())
const iso = (off) => {
  const d = new Date(Date.now() + off * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const drag = async (sel, dx, holdMs = 0) => {
  await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await page.waitForTimeout(500)
  const b = await page.locator(sel).first().boundingBox()
  const x = b.x + b.width / 2, y = b.y + b.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y, { steps: 2 })
  if (holdMs) await page.waitForTimeout(holdMs)
  await page.mouse.up()
  await page.waitForTimeout(500)
}

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })

// ---------- legacy data migrates ----------
await page.evaluate(() => {
  localStorage.setItem('registracijos-bylos:v1', JSON.stringify([{
    id: 'old', brand: 'Nissan', model: 'SenaByla', vin: '9', regNumber: 'OLD1', manager: 'M',
    date: '2026-08-20', salon: 'L1', fleet: false, vehicleCount: 1, caseType: 'registracija',
    techSheetNeeded: true, regitraDone: true, completed: false, notes: '', createdAt: 1, completedAt: null,
  }]))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
let st = await stored()
if (st[0].stage !== 'regitra') fail(`legacy regitraDone → stage: ${st[0].stage}`)
if (st[0].techSheet !== 'needed') fail(`legacy techSheetNeeded → techSheet: ${st[0].techSheet}`)
if ('regitraDone' in st[0]) fail('legacy flag not dropped')
if ('tasks' in st[0]) fail('the short-lived per-case tasks field should be dropped')
if (typeof st[0].reservedAt !== 'string') fail('reservedAt not backfilled')

// ---------- sections: only what exists, in workflow order ----------
await seed([
  { id: 'a', model: 'Vezama' },
  { id: 'b', model: 'Regitroj', stage: 'regitra', regitraAt: Date.now() },
  { id: 'c', model: 'Paimti', stage: 'pickup', pickupAt: Date.now() },
  { id: 'd', model: 'Apziura', caseType: 'apziura' },
  { id: 'e', model: 'Tapatybe', caseType: 'tapatybe' },
])
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
let c = await caps()
if (c.length !== 5) fail('expected five sections: ' + c.join(' | '))
const order = ['Vežti', 'Regitroje', 'Paimti iš Regitros', 'Apžiūra', 'Tapatybė']
order.forEach((name, i) => { if (!c[i].startsWith(name)) fail(`section ${i} should be ${name}: ${c[i]}`) })

await seed([{ id: 'a', model: 'Vezama' }])
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
c = await caps()
if (c.length !== 1 || !c[0].startsWith('Vežti')) fail('empty sections should not render: ' + c.join(' | '))
if (await page.locator('.hc-item.c-reg').count()) fail('zero counts should stay out of the header')

// ---------- the stage loop ----------
await drag(".case-card:has-text('Vezama') .case-row", 130)
if ((await stored())[0].stage !== 'take') fail('a quick flick must not move the case')
for (const [i, expect] of [[0, 'regitra'], [1, 'pickup'], [2, 'take'], [3, 'regitra']]) {
  await drag(".case-card:has-text('Vezama') .case-row", 130, 700)
  if ((await stored())[0].stage !== expect) fail(`swipe ${i + 1} should land on ${expect}, got ${(await stored())[0].stage}`)
}
if (typeof (await stored())[0].regitraAt !== 'number') fail('regitraAt not stamped')

// ---------- completing and undo ----------
await drag(".case-card:has-text('Vezama') .case-row", -130)
if (!(await page.locator('.dialog-sheet').count())) fail('left swipe did not ask for confirmation')
await page.click('.btn-success')
await page.waitForTimeout(600)
if (!(await stored())[0].completed) fail('case not archived')
await page.click('.undo-toast button')
await page.waitForTimeout(500)
if ((await stored())[0].completed) fail('undo did not restore the case')

// ---------- an errand hands over to Regitra ----------
await seed([{ id: 'x', model: 'Apziura', caseType: 'apziura' }])
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await drag(".case-card:has-text('Apziura') .case-row", 130, 700)
st = await stored()
if (st[0].caseType !== 'registracija' || st[0].stage !== 'regitra') fail('errand did not hand over')

// ---------- reservations lead the list ----------
await seed([
  { id: 'p1', model: 'BeRezervacijos', date: '2026-01-01' },
  { id: 'p2', model: 'Rytoj', date: '2026-07-01', reservedAt: iso(1) },
  { id: 'p3', model: 'Siandien', date: '2026-07-02', reservedAt: iso(0) },
])
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const models = await page.locator('.case-model').allTextContents()
if (models[0] !== 'Siandien' || models[1] !== 'Rytoj') fail('reservations not sorted first: ' + models.join(','))
if ((await page.locator('.hc-item.c-due strong').textContent()) !== '1') fail('deadline count wrong')

// ---------- the form writes a case ----------
await page.click("button[aria-label='Nauja byla']")
await page.waitForTimeout(400)
await page.click(".brand-segmented button:text-is('Kita')")
await page.fill("input[aria-label='Markės pavadinimas']", 'Dacia')
await page.fill('#f-model', 'Sandero')
await page.fill('#f-vin', '4eg7')
await page.fill('#f-manager', 'Testas T.')
await page.click(".case-form button:has-text('Pridėti bylą')")
await page.waitForTimeout(600)
const made = (await stored()).find((x) => x.model === 'Sandero')
if (!made || made.brand !== 'Dacia') fail('hand-typed brand not saved')
if (made.vin !== '4EG7') fail('VIN not upper-cased: ' + made.vin)

// ---------- bulk complete ----------
await seed([
  { id: 'k1', model: 'PaimtiA', stage: 'pickup', pickupAt: Date.now() },
  { id: 'k2', model: 'PaimtiB', stage: 'pickup', pickupAt: Date.now() },
])
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.click("button[aria-label='Užbaigti paimtas bylas']")
await page.waitForTimeout(400)
await page.locator(".bulk-item:has-text('PaimtiB')").click()
await page.click('.dialog-actions .btn-success')
await page.waitForTimeout(700)
st = await stored()
if (!st.find((x) => x.id === 'k1').completed) fail('ticked case not archived')
if (st.find((x) => x.id === 'k2').completed) fail('unticked case must stay active')

// ---------- archive counts vehicles, not just cases ----------
await seed([
  { id: 'z1', model: 'Viena', completed: true, completedAt: Date.now() },
  { id: 'z2', model: 'Fleet', fleet: true, vehicleCount: 5, completed: true, completedAt: Date.now() },
])
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.click("button[aria-label='Archyvas']")
await page.waitForTimeout(400)
const cap = await page.locator('.list-caption').first().textContent()
if (!cap.includes('2 bylos') || !cap.includes('6 automobiliai')) fail('archive stats wrong: ' + cap)

// ---------- the phone back button peels layers ----------
await page.goBack()
await page.waitForTimeout(500)
if (!(await page.locator("button[aria-label='Nauja byla']").count())) fail('back should return to the case list')

// ---------- notes screen: routines reset daily ----------
await page.evaluate(() => {
  localStorage.setItem('rb:routines', JSON.stringify([{ id: 'r1', text: 'Patikrinti paštą' }]))
  localStorage.setItem('rb:routineDone', JSON.stringify({ date: 'Mon Jan 01 2020', done: ['r1'] }))
  localStorage.setItem('rb:todos', JSON.stringify([]))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const done = await page.evaluate(() => JSON.parse(localStorage.getItem('rb:routineDone')))
if (done.done.length !== 0) fail('routine ticks should clear on a new day')
if (!(await page.locator('.btn-dot').count())) fail('badge dot missing while a routine is pending')

console.log(process.exitCode ? 'CORE: FAILURES' : 'CORE: ALL PASS')
await browser.close()
