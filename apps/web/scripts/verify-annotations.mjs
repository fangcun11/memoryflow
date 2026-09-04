// 标注语法 → 解析 → 出卡 链路验证（Node 直跑 core TS 源码）
import { parseTextToBlocks } from '../../../packages/core/src/textParser.ts'
import { generateCards } from '../../../packages/core/src/cardGenerator.ts'

const text = `唯物辩证法

**唯物辩证法**是研究自然、社会和思维发展一般规律的科学。

实践标准

实践是{{检验真理}}的唯一标准。

选择一道

?矛盾的两种基本属性是|同一性|斗争性|普遍性

判断题

!矛盾是事物发展的根本动力

!~实践是认识的唯一来源`

const { blocks } = parseTextToBlocks(text, '标注测试')
console.log('blocks:', blocks.length)
for (const b of blocks) {
  console.log('  [' + (b.title || '无标题') + '] annotations:', b.annotations?.map(a => a.type).join(',') || '无')
}

const cards = generateCards(blocks, ['recall', 'cloze', 'choice', 'judge'])
console.log('\ncards:', cards.length)
for (const c of cards) {
  let extra = ''
  if (c.options) extra = ' options=' + c.options.length
  if (c.judgeAnswer !== undefined) extra = ' answer=' + c.judgeAnswer
  console.log('  ' + c.type.padEnd(7) + ' front=' + JSON.stringify(c.front.slice(0, 32)) + ' | back=' + JSON.stringify(c.back.slice(0, 24)) + extra)
}

let fail = 0
const assert = (cond, msg) => {
  if (!cond) { fail++; console.error('FAIL: ' + msg) } else { console.log('ok: ' + msg) }
}

const types = new Set(cards.map(c => c.type))
assert(types.has('recall'), '有记忆卡')
assert(types.has('cloze'), '有填空卡')
assert(types.has('choice'), '有选择题')
assert(types.has('judge'), '有判断题')

const recall = cards.find(c => c.type === 'recall')
assert(recall && recall.front === '唯物辩证法', '记忆卡 front=「唯物辩证法」 (actual=' + (recall && recall.front) + ')')

const choice = cards.find(c => c.type === 'choice')
assert(choice && choice.options && choice.options.length === 3 && choice.answerIndex === 0, '选择题 3 选项 answerIndex=0')

const j1 = cards.find(c => c.type === 'judge' && c.front.includes('根本动力'))
const j2 = cards.find(c => c.type === 'judge' && c.front.includes('唯一来源'))
assert(!!j1 && j1.judgeAnswer === true, '判断1 陈述为真 → 答案=对')
assert(!!j2 && j2.judgeAnswer === false, '判断2 否定式 !~ → 答案=错')

// cloze 内容应为去掉花括号后的原句
const cloze = cards.find(c => c.type === 'cloze')
assert(!!cloze && !cloze.back.includes('{{'), '填空卡 back 无残留花括号')

console.log(fail === 0 ? '\nANNOTATIONS ALL PASSED' : '\n' + fail + ' FAILED')
process.exit(fail === 0 ? 0 : 1)