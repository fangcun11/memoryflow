// 演示种子逻辑验证（Node 环境，复刻 demoSeed 核心逻辑跑断言）
// 运行：node scripts/verify-demo-seed.mjs
import { sm2Update } from '../../../packages/core/src/sm2.ts'
import { generateCards } from '../../../packages/core/src/cardGenerator.ts'
import { parseTextToBlocks } from '../../../packages/core/src/textParser.ts'

// —— 与 demoSeed.ts 相同的伪随机 ——
const rand = seed => {
  const x = Math.sin(seed * 999) * 10000
  return x - Math.floor(x)
}

const MATERIALS = [
  { title: 'A', text: '唯物辩证法\n\n唯物辩证法是关于自然、社会和思维发展一般规律的科学。它包括联系与发展的两大总特征。\n\n矛盾规律\n\n矛盾是事物发展的根本动力。矛盾的同一性是指矛盾双方相互依存、相互贯通的性质和趋势。矛盾的斗争性是指矛盾双方相互排斥、相互分离的性质和趋势。' },
  { title: 'B', text: '实践与认识\n\n实践是认识的基础，实践是认识的来源、动力、目的和检验标准。认识过程包括感性认识和理性认识两个阶段。\n\n真理\n\n真理是标志主观与客观相符合的哲学范畴，是对客观事物及其规律的正确反映。实践是检验真理的唯一标准。' },
]

let failures = 0
function assert(cond, msg) {
  if (cond) console.log(`  ok: ${msg}`)
  else { failures++; console.error(`  FAIL: ${msg}`) }
}

// 1. 材料解析 → 出卡
let blockIds = []
let allCards = []
for (const m of MATERIALS) {
  const { blocks } = parseTextToBlocks(m.text, m.title)
  assert(blocks.length >= 2, `材料「${m.title}」分出 ${blocks.length} 个知识块`)
  blockIds.push(...blocks.map(b => b.id))
  allCards.push(...generateCards(blocks, ['qa', 'cloze', 'essay']))
}
assert(allCards.length >= 8, `共生成 ${allCards.length} 张卡片`)

// 2. 模拟日志与回放
const logs = []
let id = 1
for (let day = 13; day >= 0; day--) {
  const base = new Date(); base.setHours(0, 0, 0, 0); base.setDate(base.getDate() - day)
  const count = day === 9 ? 0 : 5 + Math.floor(rand(day + 1) * 9)
  for (let i = 0; i < count && i < allCards.length; i++) {
    const card = allCards[(day * 3 + i) % allCards.length]
    const pass = rand(day * 31 + i * 7 + 3) < 0.72 + (13 - day) * 0.006
    const rating = pass ? (rand(day * 13 + i) < 0.3 ? 5 : 4) : (rand(day * 17 + i) < 0.5 ? 2 : 0)
    logs.push({ id: id++, cardId: card.id, rating, reviewedAt: base.getTime() + (9 + Math.floor(rand(i + 7) * 12)) * 3600000 + i * 60000, timeSpent: 8000 })
  }
}

// 3. 回放 SM-2
const byId = new Map(allCards.map(c => [c.id, { ...c }]))
const now = Date.now()
for (const log of logs.sort((a, b) => a.reviewedAt - b.reviewedAt)) {
  const card = byId.get(log.cardId)
  if (!card) continue
  const updates = sm2Update(card, log.rating)
  Object.assign(card, updates, { dueDate: log.reviewedAt + updates.interval * 86400000 })
}
const evolved = [...byId.values()]

// 4. 断言
const correct = logs.filter(l => l.rating >= 3).length
const accuracy = correct / logs.length
assert(accuracy > 0.65 && accuracy < 0.9, `总正确率 ${(accuracy * 100).toFixed(1)}%（应在 65%~90%）`)

const daySet = new Set(logs.map(l => { const d = new Date(l.reviewedAt); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }))
let streak = 0
const t = new Date()
for (let i = 0; i < 30; i++) {
  const key = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`
  if (daySet.has(key)) streak++
  else if (i > 0) break
  t.setDate(t.getDate() - 1)
}
assert(streak >= 4, `连续天数 ${streak} 天（应 ≥4，第 9 天休息日不算断签）`)

// 与 demoSeed.ts 相同的"到期卡拉回"逻辑（验证脚本必须同步这段）
const todayMorning = new Date()
todayMorning.setHours(8, 0, 0, 0)
const targetDue = todayMorning.getTime() - Math.floor(Math.random() * 3600000)
const reviewedRecently = new Set(
  logs.filter(l => l.reviewedAt >= now - 3 * 86400000).map(l => l.cardId)
)
const untouched = evolved.filter(
  c => c.repetitions > 0 && !reviewedRecently.has(c.id)
)
const pulled = new Set()
for (const c of untouched.slice(0, 6)) {
  c.dueDate = targetDue
  pulled.add(c.id)
}
if (pulled.size < 6) {
  const recentCards = evolved.filter(c => c.repetitions > 0 && !pulled.has(c.id))
  const shuffled = [...recentCards].sort(
    (a, b) => (a.id.charCodeAt(a.id.length - 1) % 17) - (b.id.charCodeAt(b.id.length - 1) % 17)
  )
  for (const c of shuffled.slice(0, 6 - pulled.size)) {
    c.dueDate = targetDue
    pulled.add(c.id)
  }
}

const dueToday = evolved.filter(c => c.dueDate <= now && c.repetitions > 0).length
const fresh = evolved.filter(c => c.repetitions === 0).length
const mastered = evolved.filter(c => c.repetitions >= 3 && c.lapses === 0).length
assert(dueToday > 0, `今日到期卡 ${dueToday} 张（>0）`)
assert(fresh > 0, `从未复习的新卡 ${fresh} 张（>0）`)
assert(mastered > 0, `已掌握卡（rep≥3 无失误）${mastered} 张（>0）`)

const todayCount = logs.filter(l => l.reviewedAt >= new Date().setHours(0, 0, 0, 0)).length
assert(todayCount > 0, `今天已有 ${todayCount} 条复习记录（统计页"今日复习"非零）`)

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECKS FAILED`)
process.exit(failures === 0 ? 0 : 1)
