// The day's to-do list surfaced above the cases, plus the tech sheet on every
// case type. Tasks are deliberately NOT attached to a case.
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 384, height: 832 } })
const fail = (m) => { console.log('FAIL:', m); process.exitCode = 1 }

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.removeItem('rb:todos')
  localStorage.setItem('registracijos-bylos:v1', JSON.stringify([{
    id: 't1', brand: 'Nissan', model: 'Qashqai', vin: '3129', regNumber: '', manager: 'Kasparas',
    salon: 'L1', techSheet: 'none', notes: '', reservedAt: '', fleet: false, vehicleCount: 1,
    fleetVehicles: [], completed: false, regitraAt: null, pickupAt: null, completedAt: null,
    stage: 'take', caseType: 'tapatybe', date: '2026-08-24', createdAt: 1,
  }]))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const card = page.locator(".case-card:has-text('Qashqai')")
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('registracijos-bylos:v1'))[0])
const todos = () => page.evaluate(() => JSON.parse(localStorage.getItem('rb:todos') || '[]'))
const isOpen = () => card.locator('.notes-wrap.open').count().then((n) => n > 0)
const expand = async () => { if (!(await isOpen())) { await card.locator('.case-row').click(); await page.waitForTimeout(400) } }

// ---------- the tech sheet is on every case type ----------
if (!(await card.locator('.doc-btn').count())) fail('tech sheet button missing on an identity case')
await expand()
await card.locator("button:has-text('Redaguoti')").click()
await page.waitForTimeout(400)
if (!(await page.locator(".field-label:has-text('Techninis lapas')").count())) fail('tech sheet field hidden for identity case')
await page.click('.segmented button:text-is("Reikia")')
await page.click(".case-form button:has-text('Išsaugoti')")
await page.waitForTimeout(600)
if ((await stored()).techSheet !== 'needed') fail('tech sheet not saved on an identity case')
await card.locator('.doc-btn').click()
await page.waitForTimeout(300)
if ((await stored()).techSheet !== 'have') fail('tech sheet did not toggle from the card')

// ---------- a case carries no tasks of its own ----------
if ('tasks' in (await stored())) fail('cases should not carry tasks any more')
if (await card.locator('.task-strip').count()) fail('no task belongs to a card')

// ---------- nothing is pinned while the list is empty ----------
if (await page.locator('.day-tasks').count()) fail('the task strip should stay hidden with no tasks')

// ---------- adding one from Užrašai pins it above the cases ----------
await page.click("button[aria-label='Užrašai']")
await page.waitForTimeout(400)
await page.fill("input[placeholder='Pvz.: paimti sąskaitas faktūras']", 'Nuvežti sąskaitas')
await page.click("button[aria-label='Pridėti darbą']")
await page.waitForTimeout(300)
await page.click("button[aria-label='Grįžti']")
await page.waitForTimeout(400)
let strips = await page.locator('.day-tasks .task-strip-text').allTextContents()
if (strips.join() !== 'Nuvežti sąskaitas') fail('task not pinned above the cases: ' + strips.join(' | '))
// and it sits above the case list
const order = await page.evaluate(() => {
  const t = document.querySelector('.day-tasks')
  const c = document.querySelector('.case-card')
  return t.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING ? 'tasks-first' : 'cards-first'
})
if (order !== 'tasks-first') fail('tasks must come before the cases')

// ---------- the pinned strip is read-only apart from its checkboxes ----------
if (await page.locator('.day-tasks button:not(.task-check)').count()) fail('the pinned strip should carry nothing but checkboxes')
// a second task, added where tasks are written
await page.click("button[aria-label='Užrašai']")
await page.waitForTimeout(400)
await page.fill("input[placeholder='Pvz.: paimti sąskaitas faktūras']", 'Paimti antspaudą')
await page.click("button[aria-label='Pridėti darbą']")
await page.waitForTimeout(300)
await page.click("button[aria-label='Grįžti']")
await page.waitForTimeout(400)
strips = await page.locator('.day-tasks .task-strip-text').allTextContents()
if (strips.length !== 2 || !strips.includes('Paimti antspaudą')) fail('second task not pinned: ' + strips.join(' | '))
if ((await todos()).length !== 2) fail('day list out of step')

// ---------- ticking one clears it from the top but keeps it in Užrašai ----------
await page.locator('.day-tasks .task-check').first().click()
await page.waitForTimeout(400)
strips = await page.locator('.day-tasks .task-strip-text').allTextContents()
if (strips.length !== 1) fail('done task should leave the pinned strip: ' + strips.join(' | '))
let list = await todos()
if (list.length !== 2) fail('completing a task must not delete it')
if (!list.find((t) => t.text === 'Nuvežti sąskaitas').done) fail('task not marked done')

// ---------- last one done → the strip disappears ----------
await page.locator('.day-tasks .task-check').first().click()
await page.waitForTimeout(400)
if (await page.locator('.day-tasks').count()) fail('the strip should vanish once everything is done')
if ((await todos()).filter((t) => !t.done).length !== 0) fail('tasks not all done')

// ---------- and it stays out of the archive ----------
await page.evaluate(() => localStorage.setItem('rb:todos', JSON.stringify([{ id: 'x', text: 'Liko', done: false }])))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
if (!(await page.locator('.day-tasks').count())) fail('pinned strip missing after reload')
await page.click("button[aria-label='Archyvas']")
await page.waitForTimeout(400)
if (await page.locator('.day-tasks').count()) fail('tasks should not show in the archive')

console.log(process.exitCode ? 'TASKS: FAILURES' : 'TASKS: ALL PASS')
await browser.close()
