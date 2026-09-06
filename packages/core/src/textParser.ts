// ============================================================
// 文本导入 & 知识分块（纯函数，零 DOM 依赖）
// ============================================================

import { createId } from './id.ts'
import type { BlockAnnotation, Document, KnowledgeBlock } from './types.ts'

/** 支持的预设标签 */
export const PRESET_TAGS = [
  '马原', '毛中特', '习思想', '党史', '时政',
  '辩证法', '唯物论', '认识论', '唯物史观',
  '高频', '易混淆', '重点', '难点',
]

/**
 * 从纯文本创建文档和知识块
 */
export function parseTextToBlocks(
  text: string,
  title: string,
  options?: {
    maxChunkSize?: number // 默认 300 字
    minChunkSize?: number // 默认 30 字
  }
): { document: Document; blocks: KnowledgeBlock[] } {
  const maxChunk = options?.maxChunkSize ?? 300
  const minChunk = options?.minChunkSize ?? 30

  const doc: Document = {
    id: createId(),
    title,
    fileType: 'paste',
    createdAt: Date.now(),
  }

  // 清洗文本
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // 按段落分块
  const paragraphs = cleaned.split(/\n\n+/)
  const blocks: KnowledgeBlock[] = []

  let currentContent = ''

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    // 标注行（<choice>… / !判断 / **名解** / {{填空}}）不参与标题检测，
    // 否则会被短行规则误判为标题而拆散标注
    const isAnnotationLine =
      /^[!?]/.test(trimmed) || /^\*\*/.test(trimmed) || /^\{\{.*\}\}/.test(trimmed) || /^<[/]?[a-zA-Z]/.test(trimmed)

    // 检测标题行（#开头，或短行后跟长内容）；标注行恒非标题
    const isHeading =
      isAnnotationLine
        ? false
        : /^#{1,4}\s/.test(trimmed) || (trimmed.length < 20 && !trimmed.endsWith('。'))

    if (isHeading && currentContent.length > minChunk) {
      // 保存当前块
      const title = extractTitle(currentContent)
      blocks.push(createBlock(doc.id, currentContent, title))
      currentContent = ''
    }

    currentContent += (currentContent ? '\n' : '') + trimmed

    // 如果当前块超过最大长度，强制切分
    while (currentContent.length > maxChunk) {
      const cutPoint = findCutPoint(currentContent, maxChunk)
      const chunk = currentContent.slice(0, cutPoint).trim()
      const title = extractTitle(chunk)
      blocks.push(createBlock(doc.id, chunk, title))
      currentContent = currentContent.slice(cutPoint).trim()
    }
  }

  // 处理剩余内容
  if (currentContent.length >= minChunk) {
    const title = extractTitle(currentContent)
    blocks.push(createBlock(doc.id, currentContent, title))
  }

  // 如果分块太少，尝试按句子拆分
  if (blocks.length < 2 && cleaned.length > maxChunk) {
    blocks.length = 0
    const sentences = cleaned.split(/(?<=[。！？])/g)
    let buffer = ''
    for (const sent of sentences) {
      buffer += sent
      if (buffer.length >= minChunk) {
        const title = extractTitle(buffer)
        blocks.push(createBlock(doc.id, buffer.trim(), title))
        buffer = ''
      }
    }
    if (buffer.trim().length >= minChunk) {
      blocks.push(createBlock(doc.id, buffer.trim(), extractTitle(buffer)))
    }
  }

  return { document: doc, blocks }
}

function createBlock(
  documentId: string,
  content: string,
  title?: string
): KnowledgeBlock {
  return {
    id: createId(),
    documentId,
    content,
    title,
    tags: [],
    difficulty: 3,
    relatedIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    annotations: scanAnnotations(content),
  }
}

// ============================================================
// 标注解析
// 主入口 scanAnnotations：标签语法（agent 创作主入口）+ 旧符号语法（兼容别名）
//
// 标签语法：
//   <recall hint="提示">术语</recall>       → recall 记忆卡（名解）
//   <cloze group="1">关键词</cloze>        → 填空（按 group 分组出卡）
//   <choice stem="题干"> <opt correct>正确</opt> <opt>干扰</opt> <explain>解析</explain> </choice>
//   <judge value="true|false">陈述</judge>
//   <idiom cmp="易混成语">成语</idiom>      → 名解卡 + 易混提示
//   <hl color="amber">内容</hl>            → 高亮（不出卡）
//   <note>批注正文</note>                  → 批注（不出卡）
//
// 旧符号别名：**名解** / {{填空}} / ?题干|正确|干扰 / !陈述 / !~陈述
// ============================================================

const KNOWN_INLINE_TAGS = ['recall', 'cloze', 'hl', 'highlight', 'note', 'idiom'] as const

function parseAttrs(attrText: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([a-zA-Z][\w-]*)\s*=\s*"([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(attrText)) !== null) attrs[m[1]] = m[2]
  return attrs
}

/** 标签语法扫描（容错：属性值不闭合按空属性处理，未闭合标签捕获到 content 末尾） */
export function scanTagAnnotations(content: string): BlockAnnotation[] {
  const annotations: BlockAnnotation[] = []

  // 内联标签：<recall> <cloze> <hl> <note> <idiom>
  const inlineRe = /<(recall|cloze|hl|highlight|note|idiom)((?:\s+[\w-]+="[^"]*")*)?>([^<]*)<\/\1>/g
  let m: RegExpExecArray | null
  while ((m = inlineRe.exec(content)) !== null) {
    const attrs = parseAttrs(m[2] ?? '')
    const start = m.index
    const end = m.index + m[0].length
    switch (m[1]) {
      case 'recall':
        annotations.push({ type: 'recall', start, end, payload: attrs.hint })
        break
      case 'cloze':
        annotations.push({
          type: 'cloze',
          start,
          end,
          groupId: attrs.group ? Number(attrs.group) : undefined,
        })
        break
      case 'hl':
      case 'highlight':
        annotations.push({ type: 'highlight', start, end, display: attrs.color })
        break
      case 'note':
        annotations.push({ type: 'note', start, end, payload: m[3] })
        break
      case 'idiom':
        annotations.push({ type: 'idiom', start, end, payload: attrs.cmp })
        break
    }
  }

  // 多行选择：<choice stem="题干"> <opt correct>..</opt> <opt>..</opt> <explain>..</explain> </choice>
  const choiceRe = /<choice((?:\s+[\w-]+="[^"]*")*)?>([\s\S]*?)<\/choice>/g
  while ((m = choiceRe.exec(content)) !== null) {
    const attrs = parseAttrs(m[1] ?? '')
    const body = m[2]
    const opts: { text: string; correct: boolean }[] = []
    const optRe = /<opt(\s+correct)?>([^<]*)<\/opt>/g
    let om: RegExpExecArray | null
    while ((om = optRe.exec(body)) !== null) {
      opts.push({ text: om[2].trim(), correct: !!om[1] })
    }
    const explain = body.match(/<explain>([^<]*)<\/explain>/)?.[1]?.trim()
    const stem = attrs.stem?.trim() || body.split(/<opt/)[0].trim()
    if (opts.length >= 2) {
      // 正确项放首位（生成约定 answerIndex=0，展示时洗牌）
      const correctIdx = opts.findIndex(o => o.correct)
      const ordered = correctIdx > 0 ? [opts[correctIdx], ...opts.filter((_, i) => i !== correctIdx)] : opts
      annotations.push({
        type: 'choice',
        start: m.index,
        end: m.index + m[0].length,
        stem,
        answer: ordered[0].text,
        options: ordered.map(o => o.text),
        payload: explain,
      })
    }
  }

  // 判断：<judge value="false">陈述</judge>
  const judgeRe = /<judge((?:\s+[\w-]+="[^"]*")*)?>([^<]*)<\/judge>/g
  while ((m = judgeRe.exec(content)) !== null) {
    const attrs = parseAttrs(m[1] ?? '')
    annotations.push({
      type: 'judge',
      start: m.index,
      end: m.index + m[0].length,
      judgeTrue: attrs.value !== 'false', // 默认陈述为真
    })
  }

  return annotations
}

/**
 * 旧符号语法扫描（别名，向后兼容）：**名解** / {{填空}} / ?选择 / !判断
 */
export function scanLegacyAnnotations(content: string): BlockAnnotation[] {
  const annotations: BlockAnnotation[] = []
  let m: RegExpExecArray | null

  // **名解** —— 术语加粗
  const recallRe = /\*\*(.+?)\*\*/g
  while ((m = recallRe.exec(content)) !== null) {
    annotations.push({ type: 'recall', start: m.index, end: m.index + m[0].length })
  }

  // {{c1::关键词}} 或 {{关键词}} —— 挖空
  const clozeRe = /\{\{\s*(?:c(\d+)\s*::)?(.+?)\s*\}\}/g
  while ((m = clozeRe.exec(content)) !== null) {
    annotations.push({
      type: 'cloze',
      start: m.index,
      end: m.index + m[0].length,
      groupId: m[1] ? Number(m[1]) : undefined,
    })
  }

  // ?题干|正确项|干扰A|干扰B —— 选择题（单行）
  const choiceRe = /^\?\s*(.+)$/gm
  while ((m = choiceRe.exec(content)) !== null) {
    const parts = m[1].split('|').map(s => s.trim()).filter(Boolean)
    if (parts.length >= 3) {
      const [stem, correct, ...distractors] = parts
      annotations.push({
        type: 'choice',
        start: m.index,
        end: m.index + m[0].length,
        stem: stem.trim(),
        answer: correct,
        options: [correct, ...distractors],
      })
    }
  }

  // !陈述 / !~陈述 —— 判断题（单行）
  const judgeRe = /^!(~?)\s*(.+)$/gm
  while ((m = judgeRe.exec(content)) !== null) {
    annotations.push({
      type: 'judge',
      start: m.index,
      end: m.index + m[0].length,
      judgeTrue: m[1] !== '~',
    })
  }

  return annotations
}

export function scanAnnotations(content: string): BlockAnnotation[] {
  const all = [...scanTagAnnotations(content), ...scanLegacyAnnotations(content)]
  return all.sort((a, b) => a.start - b.start)
}

/**
 * 内容标注体检：供 agent 创作自检 / 导入预览提示
 * 返回人类可读的警告列表（空数组 = 通过）
 */
export function lintAnnotations(content: string): string[] {
  const warnings = new Set<string>()

  // 未知/拼错的标签（如 <Recall>、<clozes>）
  const anyTagRe = /<(\/?)([a-zA-Z][\w-]*)/g
  let m: RegExpExecArray | null
  while ((m = anyTagRe.exec(content)) !== null) {
    const name = m[2].toLowerCase()
    const known = [...KNOWN_INLINE_TAGS, 'choice', 'judge', 'opt', 'explain'].includes(name)
    if (!known) {
      warnings.add(`未知标注标签 <${m[2]}>（可用：recall/cloze/hl/note/idiom/choice/judge）`)
    }
  }

  // 内联标签未闭合：开标签数量与闭标签不匹配
  for (const tag of KNOWN_INLINE_TAGS) {
    const opens = (content.match(new RegExp(`<${tag}(\\s|>)`, 'g')) || []).length
    const closes = (content.match(new RegExp(`</${tag}>`, 'g')) || []).length
    if (opens !== closes) {
      warnings.add(`<${tag}> 有 ${opens} 个开标签、${closes} 个闭标签，存在未闭合`)
    }
  }
  const choiceOpens = (content.match(/<choice(\s|>)/g) || []).length
  const choiceCloses = (content.match(/<\/choice>/g) || []).length
  if (choiceOpens !== choiceCloses) {
    warnings.add(`<choice> 有 ${choiceOpens} 个开标签、${choiceCloses} 个闭标签，存在未闭合`)
  }

  // 选项不足（choice 至少 1 正确 + 1 干扰）
  const choiceRe = /<choice[\s\S]*?<\/choice>/g
  while ((m = choiceRe.exec(content)) !== null) {
    const optCount = (m[0].match(/<opt/g) || []).length
    if (optCount < 2) {
      warnings.add(`选择题只有 ${optCount} 个 <opt>，至少需要正确项 + 1 个干扰项`)
    } else if (!/<opt\s+correct>/.test(m[0])) {
      warnings.add('选择题未标出正确项（<opt correct>）')
    }
  }

  // choice 标记了多个正确项
  const multiCorrect = content.match(/<opt correct>/g)
  const choiceBlocks = content.match(/<choice[\s\S]*?<\/choice>/g) || []
  if (multiCorrect && multiCorrect.length > choiceBlocks.length) {
    warnings.add('存在标注多个 <opt correct> 的选择题（每题只能有一个正确项）')
  }

  return [...warnings]
}

function extractTitle(content: string): string | undefined {
  // 尝试提取 # 标题
  const headingMatch = content.match(/^#{1,4}\s+(.+)/m)
  if (headingMatch) return headingMatch[1].trim()

  // 尝试提取第一句话
  const firstSentence = content.split(/[。！？]/)[0]
  if (firstSentence && firstSentence.length < 30) {
    return firstSentence.trim()
  }

  // 截取前20字
  return content.slice(0, 20).trim()
}

function findCutPoint(text: string, maxLen: number): number {
  // 优先在句号处切分
  const cutRange = text.slice(maxLen - 50, maxLen + 50)
  const periodIdx = cutRange.search(/[。！？]/)
  if (periodIdx >= 0) {
    return adjustCutPastTag(text, maxLen - 50 + periodIdx + 1)
  }
  // 次选逗号
  const commaIdx = cutRange.search(/[，；,;]/)
  if (commaIdx >= 0) {
    return adjustCutPastTag(text, maxLen - 50 + commaIdx + 1)
  }
  // 兜底：按空格
  const spaceIdx = text.lastIndexOf(' ', maxLen)
  if (spaceIdx > maxLen - 80) return adjustCutPastTag(text, spaceIdx + 1)

  return adjustCutPastTag(text, maxLen)
}

/**
 * 强制切分点落在标注标签内部时，把切点外移到所属元素结束后。
 * 防两种情况：① 切在 <tag …> 标记中间；② 切在嵌套元素内容里
 * （如 </explain> 之后、外层 </choice> 之前 —— 内层闭标签结束≠安全）。
 */
function adjustCutPastTag(text: string, pos: number): number {
  let p = pos
  // 循环外移：移出一层后可能仍被外层元素覆盖（如 </explain> 之后还在 <choice> 里）
  for (let guard = 0; guard < 10; guard++) {
    // 情况①：切点在某个标签的标记字符中间
    const lastOpen = text.lastIndexOf('<', p - 1)
    if (lastOpen >= 0) {
      const gt = text.indexOf('>', lastOpen)
      if (gt < 0) return p // 无闭合 '>'，交给容错解析
      if (gt >= p) {
        p = gt + 1
        continue
      }
    }
    // 情况②：栈式扫描 p 之前的所有标签 token，找覆盖切点的最内层未闭合元素
    const stack: { name: string; closeEnd: number }[] = []
    const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w-]+="[^"]*")*)?>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null && m.index < p) {
      if (m[1] === '/') {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].name === m[2]) {
            stack.splice(i, 1)
            break
          }
        }
      } else {
        stack.push({ name: m[2], closeEnd: text.indexOf(`</${m[2]}>`, m.index) })
      }
    }
    let moved = false
    for (let i = stack.length - 1; i >= 0; i--) {
      const s = stack[i]
      if (s.closeEnd >= p) {
        p = s.closeEnd + s.name.length + 3
        moved = true
        break
      }
    }
    if (!moved) return p
  }
  return p
}
