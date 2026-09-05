// ============================================================
// 卡片生成引擎 — 规则引擎版（纯函数，零 DOM 依赖）
// 预览（previewCards）与生成（generateCards）共用同一条构建路径：
// 卡片带稳定身份 identity = blockId#签名，重出卡时由 store 合并更新而非重复追加。
// ============================================================

import { createId } from './id.ts'
import type { BlockAnnotation, KnowledgeBlock, Card, CardType, CardPreview } from './types.ts'

// 政治理论常见关键词模式
const DEFINITION_PATTERNS = [
  /(.+?)(?:是指|是)(.+)/,
  /(.+?)(?:的含义是|的定义是)(.+)/,
  /(.+?)(?:包括|包含)(.+)/,
  /(.+?)(?:核心是|关键是|本质是|实质是)(.+)/,
]

function newCard(
  block: KnowledgeBlock,
  type: CardType,
  front: string,
  back: string,
  signature?: string
): Card {
  return {
    id: createId(),
    blockId: block.id,
    type,
    front,
    back,
    identity: signature ? `${block.id}#${signature}` : undefined,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    lapses: 0,
    dueDate: Date.now(),
    createdAt: Date.now(),
  }
}

/**
 * 从知识块生成问答卡
 * @returns matched：是否匹配到定义句式（决定预览质量分级）
 */
function buildQACard(block: KnowledgeBlock): { card: Card; matched: boolean } {
  const content = block.content.trim()
  const title = block.title || content.slice(0, 20)

  let question = `【${title}】是什么？`
  let answer = content
  let matched = false

  for (const pattern of DEFINITION_PATTERNS) {
    const m = content.match(pattern)
    if (m) {
      question = `【${m[1].trim()}】是什么？`
      answer = m[2].trim()
      matched = true
      break
    }
  }

  return { card: newCard(block, 'qa', question, answer, 'rule:qa'), matched }
}

function generateQACard(block: KnowledgeBlock): Card {
  return buildQACard(block).card
}

/**
 * 从知识块生成填空卡（规则版，无标注时兜底）
 * @returns keywordHit：是否挖到了理论关键词（决定预览质量分级）
 */
function buildRuleClozeCard(block: KnowledgeBlock): { card: Card; keywordHit: boolean } {
  const content = block.content.trim()

  const sentences = content.split(/[。！？；]/).filter(s => s.trim().length > 5)
  if (sentences.length === 0) {
    return { card: generateQACard(block), keywordHit: false } // 降级为问答卡
  }

  const sentence = sentences[0].trim()
  const keywords = extractKeywords(sentence)
  if (keywords.length > 0) {
    const keyword = keywords[0]
    const cloze = sentence.replace(keyword, '{{c1::' + keyword + '}}')
    return {
      card: newCard(block, 'cloze', `填空：${cloze}`, sentence, 'rule:cloze'),
      keywordHit: true,
    }
  }

  return { card: generateQACard(block), keywordHit: false }
}

/**
 * 提取关键词（简化版 TF-IDF + 规则）
 */
function extractKeywords(sentence: string): string[] {
  const keywords: string[] = []

  // 政治理论高频词
  const theoryTerms = [
    '矛盾', '实践', '认识', '真理', '价值', '发展', '规律',
    '本质', '现象', '原因', '结果', '必然', '偶然',
    '量变', '质变', '肯定', '否定',
    '生产力', '生产关系', '经济基础', '上层建筑',
    '物质', '意识', '运动', '静止',
    '感性认识', '理性认识', '主观', '客观',
  ]

  for (const term of theoryTerms) {
    if (sentence.includes(term)) {
      keywords.push(term)
    }
  }

  // 如果没有匹配，提取引号内的内容
  if (keywords.length === 0) {
    const quoteMatch = sentence.match(/["「](.+?)["」]/)
    if (quoteMatch) keywords.push(quoteMatch[1])
  }

  // 提取"是指"、"是"后的内容
  if (keywords.length === 0) {
    const defMatch = sentence.match(/(?:是指|是)(.+)/)
    if (defMatch) keywords.push(defMatch[1].trim().slice(0, 10))
  }

  return keywords.slice(0, 3)
}

/**
 * 从知识块生成论述卡
 */
function generateEssayCard(block: KnowledgeBlock): Card {
  const content = block.content.trim()
  const title = block.title || '知识点'

  // 提取关键要点
  const points = content
    .split(/[。；]/)
    .filter(s => s.trim().length > 3)
    .map(s => s.trim())

  const front = `论述：请阐述【${title}】的主要内容`
  const back =
    points.length > 1
      ? `要点框架：\n${points.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : content

  return newCard(block, 'essay', front, back, 'rule:essay')
}

/**
 * 从知识块生成对比卡（需两个关联块）
 */
export function generateCompareCard(
  blockA: KnowledgeBlock,
  blockB: KnowledgeBlock
): Card {
  const titleA = blockA.title || blockA.content.slice(0, 15)
  const titleB = blockB.title || blockB.content.slice(0, 15)

  return newCard(
    blockA,
    'compare',
    `对比：【${titleA}】与【${titleB}】的异同`,
    `【${titleA}】：${blockA.content}\n\n【${titleB}】：${blockB.content}`,
    `compare@${blockB.id}`
  )
}

/**
 * 生成预览：与 generateCards 完全同构，但附带质量分级，
 * 供确认层默认勾选（low 默认不勾，避免兜底烂卡直接进队列）。
 */
export function previewCards(
  blocks: KnowledgeBlock[],
  types: CardType[] = ['qa', 'cloze', 'essay']
): CardPreview[] {
  const previews: CardPreview[] = []

  for (const block of blocks) {
    const annos = block.annotations ?? []

    // 1. 有标注且类型被勾选 → 按标注出卡
    if (annos.length > 0 && ['recall', 'cloze', 'choice', 'judge'].some(t => types.includes(t as CardType))) {
      let recallDone = false
      let clozeDone = false
      let annotatedAny = false

      for (const anno of annos) {
        if (anno.type === 'recall' && !recallDone && types.includes('recall')) {
          previews.push({ card: generateRecallCard(block, anno), quality: 'annotated' })
          recallDone = true
          annotatedAny = true
        } else if (anno.type === 'cloze' && !clozeDone && types.includes('cloze')) {
          previews.push({ card: generateAnnotatedClozeCard(block, annos), quality: 'annotated' })
          clozeDone = true
          annotatedAny = true
        } else if (anno.type === 'choice' && types.includes('choice')) {
          previews.push({ card: generateChoiceCard(block, anno), quality: 'annotated' })
          annotatedAny = true
        } else if (anno.type === 'judge' && types.includes('judge')) {
          previews.push({ card: generateJudgeCard(block, anno), quality: 'annotated' })
          annotatedAny = true
        }
      }
      // 已标注的块不再走规则 QA/essay，避免重复
      if (annotatedAny) continue
    }

    // 2. 规则兜底（带质量分级）
    for (const type of types) {
      switch (type) {
        case 'qa': {
          const { card, matched } = buildQACard(block)
          previews.push(
            matched
              ? { card, quality: 'ok' }
              : {
                  card,
                  quality: 'low',
                  note: '未匹配到定义句式（是指/包括/本质是…），问题为泛化的“是什么”，建议手动标注后再出卡',
                }
          )
          break
        }
        case 'cloze': {
          const { card, keywordHit } = buildRuleClozeCard(block)
          previews.push(
            keywordHit
              ? { card, quality: 'ok' }
              : {
                  card,
                  quality: 'low',
                  note: '未挖到理论关键词，挖空位置可能不理想，建议用 {{关键词}} 手动标注',
                }
          )
          break
        }
        case 'essay': {
          previews.push({
            card: generateEssayCard(block),
            quality: 'low',
            note: '要点由标点机械切分，未必符合答题框架，建议人工确认',
          })
          break
        }
        // compare 需要两个块，跳过
      }
    }
  }

  return previews
}

/**
 * 批量生成卡片（previewCards 的直接物化）
 * 优先按块内标注（annotations）定向出卡；无标注的块走规则兜底。
 */
export function generateCards(
  blocks: KnowledgeBlock[],
  types: CardType[] = ['qa', 'cloze', 'essay']
): Card[] {
  return previewCards(blocks, types).map(p => p.card)
}

/**
 * 记忆卡（名解）：由 **术语** 标注生成
 */
function generateRecallCard(block: KnowledgeBlock, anno: BlockAnnotation): Card {
  const match = block.content.slice(anno.start, anno.end).match(/\*\*(.+?)\*\*/)
  const term = (match ? match[1] : block.title || block.content.slice(0, 20)).trim()

  return newCard(
    block,
    'recall',
    term,
    // 隐藏标注符号，给出术语所在句作为定义
    block.content.replace(/\*\*(.+?)\*\*/g, '$1').trim(),
    `recall@${anno.start}`
  )
}

/**
 * 填空题：按 {{关键词}} / {{c1::关键词}} 标注挖空，而非规则关键词
 * - 正面：原文挖空（词 → ____）
 * - 背面：完整原文（词可见）
 */
function generateAnnotatedClozeCard(block: KnowledgeBlock, annos: BlockAnnotation[]): Card {
  // 身份锚定在第一处 cloze 标注：标注位置移动后视为新卡，原地编辑则更新
  const firstCloze = annos.find(a => a.type === 'cloze')
  const signature = firstCloze ? `cloze@${firstCloze.start}` : 'cloze@rule'
  const hide = block.content.replace(
    /\{\{\s*(?:c\d+\s*::)?(.+?)\s*\}\}/g,
    '____'
  )
  const show = block.content.replace(
    /\{\{\s*(?:c\d+\s*::)?(.+?)\s*\}\}/g,
    '$1'
  )
  return newCard(block, 'cloze', `填空：${hide.trim()}`, show.trim(), signature)
}

/**
 * 选择题：由 ?题干|正确项|干扰A|干扰B 标注生成
 */
function generateChoiceCard(block: KnowledgeBlock, anno: BlockAnnotation): Card {
  const stem = anno.stem ?? block.content.slice(anno.start, anno.end).split('|')[0].trim()
  const options = anno.options ?? []
  return {
    ...newCard(block, 'choice', `选择：${stem}`, `正确答案：${anno.answer ?? ''}`, `choice@${anno.start}`),
    options,
    answerIndex: 0, // 标注语法中第一项为正确项（展示时经 getShuffledOptions 洗牌）
  }
}

/**
 * 判断题：由 !陈述 / !~陈述 标注生成
 */
function generateJudgeCard(block: KnowledgeBlock, anno: BlockAnnotation): Card {
  const stmt = block.content
    .slice(anno.start, anno.end)
    .replace(/^!\s*~?\s*/, '')
    .trim()

  return {
    ...newCard(block, 'judge', `判断：${stmt}`, anno.judgeTrue ? '正确' : '错误', `judge@${anno.start}`),
    judgeAnswer: anno.judgeTrue,
  }
}

/**
 * 选择题选项展示顺序洗牌（确定性：按 card.id 做种子，同一张卡每次渲染顺序一致）
 * 生成时正确项恒为 options[0]，直接按数组顺序渲染会泄露答案，展示前必须过这里。
 */
export function getShuffledOptions(
  card: Pick<Card, 'id' | 'options' | 'answerIndex'>
): { options: string[]; correctIndex: number } {
  const options = card.options ?? []
  const items = options.map((text, i) => ({ text, correct: i === card.answerIndex }))

  let seed = 0
  for (let i = 0; i < card.id.length; i++) {
    seed = (seed * 31 + card.id.charCodeAt(i)) >>> 0
  }
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0xffffffff
  }
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }

  return {
    options: items.map(o => o.text),
    correctIndex: items.findIndex(o => o.correct),
  }
}
