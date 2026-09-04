// ============================================================
// 卡片生成引擎 — 规则引擎版（纯函数，零 DOM 依赖）
// ============================================================

import { createId } from './id'
import type { KnowledgeBlock, Card, CardType } from './types'

// 政治理论常见关键词模式
const DEFINITION_PATTERNS = [
  /(.+?)(?:是指|是)(.+)/,
  /(.+?)(?:的含义是|的定义是)(.+)/,
  /(.+?)(?:包括|包含)(.+)/,
  /(.+?)(?:核心是|关键是|本质是|实质是)(.+)/,
]

function newCard(block: KnowledgeBlock, type: CardType, front: string, back: string): Card {
  return {
    id: createId(),
    blockId: block.id,
    type,
    front,
    back,
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
 */
function generateQACard(block: KnowledgeBlock): Card {
  const content = block.content.trim()
  const title = block.title || content.slice(0, 20)

  // 尝试匹配定义模式
  let question = `【${title}】是什么？`
  let answer = content

  for (const pattern of DEFINITION_PATTERNS) {
    const match = content.match(pattern)
    if (match) {
      question = `【${match[1].trim()}】是什么？`
      answer = match[2].trim()
      break
    }
  }

  return newCard(block, 'qa', question, answer)
}

/**
 * 从知识块生成填空卡
 */
function generateClozeCard(block: KnowledgeBlock): Card {
  const content = block.content.trim()

  // 提取句子
  const sentences = content.split(/[。！？；]/).filter(s => s.trim().length > 5)
  if (sentences.length === 0) {
    return generateQACard(block) // 降级为问答卡
  }

  // 取第一个有实质内容的句子
  const sentence = sentences[0].trim()

  // 尝试挖空关键词
  const keywords = extractKeywords(sentence)
  if (keywords.length > 0) {
    const keyword = keywords[0]
    const cloze = sentence.replace(keyword, '{{c1::' + keyword + '}}')
    return newCard(block, 'cloze', `填空：${cloze}`, sentence)
  }

  return generateQACard(block)
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

  return newCard(block, 'essay', front, back)
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
    `【${titleA}】：${blockA.content}\n\n【${titleB}】：${blockB.content}`
  )
}

/**
 * 批量生成卡片
 */
export function generateCards(
  blocks: KnowledgeBlock[],
  types: CardType[] = ['qa', 'cloze', 'essay']
): Card[] {
  const cards: Card[] = []

  for (const block of blocks) {
    for (const type of types) {
      switch (type) {
        case 'qa':
          cards.push(generateQACard(block))
          break
        case 'cloze':
          cards.push(generateClozeCard(block))
          break
        case 'essay':
          cards.push(generateEssayCard(block))
          break
        // compare 需要两个块，跳过
      }
    }
  }

  return cards
}
