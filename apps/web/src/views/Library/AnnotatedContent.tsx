import type { ReactNode } from 'react'
import type { BlockAnnotation } from '@memoryflow/core'

/** 高亮颜色映射 */
const HL_COLORS: Record<string, string> = {
  amber: 'bg-amber-light text-amber',
  teal: 'bg-teal-light text-teal',
  blue: 'bg-blue-light text-blue',
  coral: 'bg-coral-light text-coral',
}

/** 内联标注的渲染样式 */
function inlineClass(type: BlockAnnotation['type'], display?: string): string {
  switch (type) {
    case 'recall':
      return 'font-medium text-ink border-b-2 border-dotted border-coral/50'
    case 'cloze':
      return 'px-1 rounded-sm bg-teal-light text-teal'
    case 'idiom':
      return 'font-medium text-coral'
    case 'highlight':
      return `px-0.5 rounded-sm ${HL_COLORS[display ?? 'amber'] ?? HL_COLORS.amber}`
    default:
      return ''
  }
}

/** 内联标注的悬浮提示 */
function inlineTitle(anno: BlockAnnotation): string | undefined {
  if (anno.type === 'note') return anno.payload
  if (anno.type === 'recall') return anno.payload ? `提示：${anno.payload}` : '名解标注'
  if (anno.type === 'cloze') return anno.groupId ? `填空（第 ${anno.groupId} 组）` : '填空标注'
  if (anno.type === 'idiom') return anno.payload ? `易混：${anno.payload}` : '成语辨析标注'
  if (anno.type === 'highlight') return '高亮'
  return undefined
}

/**
 * 知识块渲染视图：按标注把原文渲染成高亮/加粗/角标，
 * choice/judge 块渲染为结构化题目。原始文本仍是存储真相。
 */
export default function AnnotatedContent({
  content,
  annotations = [],
}: {
  content: string
  annotations?: BlockAnnotation[]
}) {
  const nodes: ReactNode[] = []
  const marks = annotations
    .filter(a => a.type !== 'highlight' || a.end > a.start)
    .sort((a, b) => a.start - b.start)

  let cursor = 0
  let key = 0

  const pushText = (text: string) => {
    if (!text) return
    // 保留换行结构
    nodes.push(<span key={key++}>{text}</span>)
  }

  for (const anno of marks) {
    if (anno.start < cursor) continue // 重叠标注跳过
    pushText(content.slice(cursor, anno.start))
    const raw = content.slice(anno.start, anno.end)

    if (anno.type === 'choice') {
      const opts = anno.options ?? []
      nodes.push(
        <div key={key++} className="my-2 rounded-lg bg-surface-soft border border-hairline p-3">
          <div className="text-sm font-medium text-body-strong mb-1.5">{anno.stem}</div>
          <div className="space-y-1">
            {opts.map((opt, i) => (
              <div key={i} className="text-xs text-body">
                <span className="inline-block w-5">{String.fromCharCode(65 + i)}.</span>
                {opt}
                {i === 0 && <span className="ml-1.5 text-success text-[11px] font-medium">✓</span>}
              </div>
            ))}
          </div>
          {anno.payload && (
            <div className="text-[11px] text-muted-soft mt-1.5 leading-relaxed">解析：{anno.payload}</div>
          )}
        </div>
      )
    } else if (anno.type === 'judge') {
      // 兼容标签壳（<judge>…</judge>）与旧符号前缀（! / !~）
      const inner = raw.replace(/<\/?judge[^>]*>/g, '').replace(/^!\s*~?\s*/, '')
      nodes.push(
        <div key={key++} className="my-2 text-sm text-body">
          <span className={`mr-2 px-1.5 py-0.5 rounded text-[11px] font-medium ${anno.judgeTrue ? 'bg-success-light text-success' : 'bg-error-light text-error'}`}>
            {anno.judgeTrue ? '√ 真' : '× 假'}
          </span>
          {inner}
        </div>
      )
    } else if (anno.type === 'note') {
      const noteText = raw.replace(/<\/?note>/g, '')
      nodes.push(
        <span key={key++} className="relative inline">
          <span
            className="align-super text-[10px] text-coral font-bold cursor-help ml-0.5"
            title={noteText}
          >
            注
          </span>
        </span>
      )
    } else {
      // recall / cloze / idiom / highlight：剥壳取内文（标签壳 + 旧符号壳都剥）
      const inner = raw
        .replace(/^<[^>]*>/, '')
        .replace(/<\/[^>]*>$/, '')
        .replace(/^\*\*(.+)\*\*$/, '$1')
        .replace(/^\{\{(?:c\d+::)?(.+)\}\}$/, '$1')
      const title = inlineTitle(anno)
      nodes.push(
        <span key={key++} className={inlineClass(anno.type, anno.display)} title={title}>
          {inner}
        </span>
      )
    }
    cursor = anno.end
  }
  pushText(content.slice(cursor))

  return <div className="whitespace-pre-wrap leading-relaxed">{nodes}</div>
}
