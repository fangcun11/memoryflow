// ============================================================
// 文本导入 & 知识分块（纯函数，零 DOM 依赖）
// ============================================================

import { createId } from './id'
import type { Document, KnowledgeBlock } from './types'

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

    // 检测标题行（#开头，或短行后跟长内容）
    const isHeading = /^#{1,4}\s/.test(trimmed) || (trimmed.length < 20 && !trimmed.endsWith('。'))

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
  }
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
    return maxLen - 50 + periodIdx + 1
  }
  // 次选逗号
  const commaIdx = cutRange.search(/[，；,;]/)
  if (commaIdx >= 0) {
    return maxLen - 50 + commaIdx + 1
  }
  // 兜底：按空格
  const spaceIdx = text.lastIndexOf(' ', maxLen)
  if (spaceIdx > maxLen - 80) return spaceIdx + 1

  return maxLen
}
