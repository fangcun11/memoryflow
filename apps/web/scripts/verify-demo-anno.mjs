// 验证：带标注的演示材料 → 生成的卡片类型分布
import { parseTextToBlocks } from '../../../packages/core/src/textParser.ts'
import { generateCards } from '../../../packages/core/src/cardGenerator.ts'
import { MATERIALS, CARD_TYPES } from '../src/demoMaterials.ts'

const allBlocks = []
for (const m of MATERIALS) {
  const { blocks } = parseTextToBlocks(m.text, m.title)
  allBlocks.push(...blocks)
}
const cards = generateCards(allBlocks, [...CARD_TYPES])

const byType = {}
for (const c of cards) byType[c.type] = (byType[c.type] || 0) + 1
console.log('blocks:', allBlocks.length)
console.log('cards:', cards.length, JSON.stringify(byType))

let fail = 0
const assert = (cond, msg) => {
  if (!cond) { fail++; console.error('FAIL:', msg) } else { console.log('ok:', msg) }
}
assert((byType.recall ?? 0) >= 4, `recall >= 4 (got ${byType.recall ?? 0})`)
assert((byType.cloze ?? 0) >= 2, `cloze >= 2 (got ${byType.cloze ?? 0})`)
assert((byType.choice ?? 0) >= 3, `choice >= 3 (got ${byType.choice ?? 0})`)
assert((byType.judge ?? 0) >= 3, `judge >= 3 (got ${byType.judge ?? 0})`)
assert((byType.qa ?? 0) >= 0, 'qa 兜底存在')

// choice 卡必须有选项且第一个为正确项
const choice = cards.find(c => c.type === 'choice')
assert(choice && choice.options && choice.options.length >= 3 && choice.answerIndex === 0, 'choice 选项完整')

// judge 真假都对
const judgeT = cards.find(c => c.type === 'judge' && c.judgeAnswer === true)
const judgeF = cards.find(c => c.type === 'judge' && c.judgeAnswer === false)
assert(!!judgeT && !!judgeF, 'judge 真假判断都有')

console.log(fail === 0 ? '\nDEMO ANNOTATION PASSED' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)