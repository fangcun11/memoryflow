// ============================================================
// 卡片生成引擎 — 规则引擎版（纯函数，零 DOM 依赖）
// 预览（previewCards）与生成（generateCards）共用同一条构建路径：
// 卡片带稳定身份 identity = blockId#签名，重出卡时由 store 合并更新而非重复追加。
// ============================================================

import { createId } from './id.ts'
import type { BlockAnnotation, KnowledgeBlock, Card, CardType, CardPreview } from './types.ts'
import { stripAnnotationTags } from './textParser.ts'

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

    // 1. 有标注且类型被勾选 → 按标注出卡（highlight/note 为纯视觉标注，不出卡）
    if (annos.length > 0 && ['recall', 'cloze', 'choice', 'judge', 'idiom'].some(t => types.includes(t as CardType))) {
      let annotatedAny = false
      let clozeHandled = false

      for (const anno of annos) {
        if (anno.type === 'recall' && types.includes('recall')) {
          previews.push({ card: generateRecallCard(block, anno), quality: 'annotated' })
          annotatedAny = true
        } else if (anno.type === 'idiom' && types.includes('recall')) {
          previews.push({ card: generateIdiomCard(block, anno), quality: 'annotated' })
          annotatedAny = true
        } else if (anno.type === 'cloze' && types.includes('cloze') && !clozeHandled) {
          // 按 group 分组出卡（Anki 惯例：每组一张，正面只挖本组的空）；全块一次
          for (const card of generateAnnotatedClozeCards(block, annos)) {
            previews.push({ card, quality: 'annotated' })
            annotatedAny = true
          }
          clozeHandled = true
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

// ============================================================
// 标签文本工具（生成器共用）：stripAnnotationTags 移至 textParser.ts（与标题提取共用）
// ============================================================

const INLINE_TAG_RE = /<(recall|cloze|hl|highlight|note|idiom)((?:\s+[\w-]+="[^"]*")*)?>([^<]*)<\/\1>/g

/**
 * cloze 变换：blankGroup 指定要挖空的组（null = 全部保留可见）。
 * 兼容标签 <cloze> 与旧 {{cN::}} 两种写法；其他标注标签同步剥离。
 */
function transformCloze(content: string, blankGroup: number | null): string {
  const stripped = content.replace(INLINE_TAG_RE, '$3')
  return stripped
    .replace(/<cloze((?:\s+[\w-]+="[^"]*")*)?>([^<]*)<\/cloze>/g, (_m, attrs, inner) => {
      const g = attrs ? Number(parseTagGroup(attrs)) : 0
      return blankGroup === null ? inner : g === blankGroup ? '____' : inner
    })
    .replace(/\{\{\s*(?:c(\d+)\s*::)?(.+?)\s*\}\}/g, (_m, cN, inner) => {
      const g = cN ? Number(cN) : 0
      return blankGroup === null ? inner : g === blankGroup ? '____' : inner
    })
}

function parseTagGroup(attrText: string): string {
  const m = attrText.match(/group\s*=\s*"([^"]*)"/)
  return m?.[1] ?? '0'
}

/**
 * 记忆卡（名解）：由 <recall> / **术语** 标注生成
 */
function generateRecallCard(block: KnowledgeBlock, anno: BlockAnnotation): Card {
  const raw = block.content.slice(anno.start, anno.end)
  const match = raw.match(/<recall[^>]*>([^<]*)<\/recall>/) ?? raw.match(/\*\*(.+?)\*\*/)
  const term = (match ? match[1] : block.title || block.content.slice(0, 20)).trim()

  return newCard(
    block,
    'recall',
    term,
    // 隐藏标注符号，给出术语所在块作为定义
    stripAnnotationTags(block.content).trim(),
    `recall@${anno.start}`
  )
}

/**
 * 成语/易混词卡：由 <idiom cmp="易混项">成语</idiom> 标注生成（recall 型）
 */
function generateIdiomCard(block: KnowledgeBlock, anno: BlockAnnotation): Card {
  const raw = block.content.slice(anno.start, anno.end)
  const term = raw.match(/<idiom[^>]*>([^<]*)<\/idiom>/)?.[1]?.trim() ?? block.title ?? ''
  const cmp = anno.payload ?? ''

  return newCard(
    block,
    'recall',
    `辨析：${term}`,
    `${stripAnnotationTags(block.content).trim()}${cmp ? `\n\n易混对比：${cmp}` : ''}`,
    `idiom@${anno.start}`
  )
}

/**
 * 填空题：按 <cloze group> / {{cN::}} 标注分组出卡（每组一张）
 * - 正面：只挖本组的空（其他组明文可见）
 * - 背面：完整原文
 */
function generateAnnotatedClozeCards(block: KnowledgeBlock, annos: BlockAnnotation[]): Card[] {
  const groups = new Map<number, BlockAnnotation[]>()
  for (const a of annos.filter(a => a.type === 'cloze')) {
    const g = a.groupId ?? 0
    const list = groups.get(g)
    if (list) list.push(a)
    else groups.set(g, [a])
  }

  const cards: Card[] = []
  for (const [group, groupAnnos] of groups) {
    const first = groupAnnos[0]
    const hide = transformCloze(block.content, group)
    const show = transformCloze(block.content, null)
    cards.push(
      newCard(block, 'cloze', `填空：${hide.trim()}`, show.trim(), `cloze@${first.start}@g${group}`)
    )
  }
  return cards
}

/**
 * 选择题：<choice stem="题干">（或旧 ?题干|正确|干扰）——正确项恒为 options[0]，
 * 展示时经 getShuffledOptions 洗牌；payload 为解析。
 */
function generateChoiceCard(block: KnowledgeBlock, anno: BlockAnnotation): Card {
  const stem = anno.stem ?? block.content.slice(anno.start, anno.end).split('|')[0].trim()
  const options = anno.options ?? []
  const back = `正确答案：${anno.answer ?? ''}${anno.payload ? `\n解析：${anno.payload}` : ''}`
  return {
    ...newCard(block, 'choice', `选择：${stem}`, back, `choice@${anno.start}`),
    options,
    answerIndex: 0,
  }
}

/**
 * 判断题：<judge value="true|false">陈述</judge>（或旧 !陈述 / !~陈述）
 */
function generateJudgeCard(block: KnowledgeBlock, anno: BlockAnnotation): Card {
  const raw = block.content.slice(anno.start, anno.end)
  const stmt = raw.match(/<judge[^>]*>([^<]*)<\/judge>/)?.[1]?.trim()
    ?? raw.replace(/^!\s*~?\s*/, '').trim()

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
