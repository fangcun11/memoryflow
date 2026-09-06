import { useState, useEffect, useRef } from 'react'
import { X, Type, Hash, ListChecks, Scale, Highlighter, MessageSquareDot } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import { lintAnnotations } from '@memoryflow/core'
import type { KnowledgeBlock } from '@memoryflow/core'
import AnnotatedContent from './AnnotatedContent'

interface Props {
  block: KnowledgeBlock
  onClose: () => void
}

/** 标注工具按钮：选中文本后包标签；未选中则插入模板并聚焦光标 */
const ANNOTATION_TOOLS = [
  { key: 'recall', label: '名解', icon: Type, tip: '<recall>术语</recall>' },
  { key: 'cloze', label: '填空', icon: Hash, tip: '<cloze>关键词</cloze>' },
  { key: 'choice', label: '选择', icon: ListChecks, tip: '<choice stem="题干">…' },
  { key: 'judge', label: '判断', icon: Scale, tip: '<judge value="false">陈述</judge>' },
  { key: 'highlight', label: '高亮', icon: Highlighter, tip: '<hl color="amber">内容</hl>' },
  { key: 'note', label: '批注', icon: MessageSquareDot, tip: '<note>批注正文</note>' },
]

/**
 * 编辑知识块弹层
 * 复用 ImportModal 的响应式壳：移动端 Bottom Sheet / 桌面端居中弹窗
 */
export default function EditBlockModal({ block, onClose }: Props) {
  const updateBlockContent = useStore(s => s.updateBlockContent)
  const cards = useStore(s => s.cards)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [title, setTitle] = useState(block.title ?? '')
  const [content, setContent] = useState(block.content)

  const linkedCardCount = cards.filter(c => c.blockId === block.id).length
  const contentChanged = content.trim() !== block.content
  const canSave = content.trim().length > 0
  const lintWarnings = lintAnnotations(content)

  const handleSave = () => {
    if (!canSave) return
    updateBlockContent(block.id, content, title)
    onClose()
  }

  /** 在光标/选区处插入标注标签 */
  const applyAnnotation = (key: string) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart ?? content.length
    const end = el.selectionEnd ?? content.length
    const selected = content.slice(start, end) || ''
    const before = content.slice(0, start)
    const after = content.slice(end)

    let inserted = ''
    switch (key) {
      case 'recall':
        inserted = `<recall>${selected || '待填名词'}</recall>`
        break
      case 'cloze':
        inserted = `<cloze>${selected || '待填空词'}</cloze>`
        break
      case 'choice': {
        const prefix = before.endsWith('\n') || before === '' ? '' : '\n'
        inserted = `${prefix}<choice stem="${selected || '待填题干'}">\n<opt correct>正确项</opt>\n<opt>干扰项A</opt>\n<opt>干扰项B</opt>\n</choice>`
        break
      }
      case 'judge': {
        const prefix = before.endsWith('\n') || before === '' ? '' : '\n'
        inserted = `${prefix}<judge value="false">${selected || '待填陈述'}</judge>`
        break
      }
      case 'highlight':
        inserted = `<hl color="amber">${selected || '待高亮内容'}</hl>`
        break
      case 'note': {
        const prefix = before.endsWith('\n') || before === '' ? '' : '\n'
        inserted = `${prefix}<note>${selected || '批注正文'}</note>`
        break
      }
    }
    const newContent = before + inserted + after
    setContent(newContent)
    // 光标移到插入内容末尾
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + inserted.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-ink/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="sheet-up lg:animate-none bg-canvas rounded-t-2xl sm:rounded-2xl lg:rounded-2xl w-full lg:max-w-2xl max-w-full lg:max-h-[85vh] h-full sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden sm:m-6"
        style={{ boxShadow: '0 8px 24px #14141320' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 lg:px-6 py-4 border-b border-hairline flex items-center justify-between shrink-0">
          <h3 className="font-serif text-lg font-medium text-ink">编辑知识块</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-surface-soft active:bg-surface-soft flex items-center justify-center text-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto p-5 lg:p-6 space-y-4 flex flex-col">
          <div className="shrink-0">
            <label className="block text-sm font-medium text-body-strong mb-1.5">标题</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="可留空"
              className="w-full px-4 py-2.5 bg-surface-card border border-hairline rounded-lg text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-coral focus:shadow-ring-focus transition-all"
            />
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-1.5 shrink-0">
              <label className="text-sm font-medium text-body-strong">内容</label>
              <span className="text-xs text-muted-soft">选中文字后点按钮快速标注</span>
            </div>
            {/* 标注工具条 */}
            <div className="flex items-center gap-1.5 mb-2 shrink-0 flex-wrap">
              {ANNOTATION_TOOLS.map(tool => (
                <button
                  key={tool.key}
                  onClick={() => applyAnnotation(tool.key)}
                  title={`标注为${tool.label}：${tool.tip}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-hairline bg-surface-card text-xs text-body-strong hover:border-coral/50 hover:text-coral transition-colors"
                >
                  <tool.icon className="w-3.5 h-3.5" strokeWidth={2} />
                  {tool.label}
                </button>
              ))}
              <span className="text-[11px] text-muted-soft ml-auto hidden lg:inline">
                标签语法：{'<recall>'}名解 · {'<cloze>'}填空 · {'<choice stem="题干">'} · {'<judge value="false">'} · {'<hl>'}高亮 · {'<note>'}批注
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={Math.min(16, Math.max(6, Math.ceil(content.length / 40)))}
              className="w-full flex-1 min-h-[180px] px-4 py-3 bg-surface-card border border-hairline rounded-lg text-sm text-ink resize-y focus:outline-none focus:border-coral focus:shadow-ring-focus transition-all leading-relaxed font-mono"
            />
            {/* 标注体检：实时 lint 提示 */}
            {lintWarnings.length > 0 && (
              <div className="shrink-0 rounded-lg bg-amber-light border border-amber/30 px-3 py-2 space-y-0.5">
                {lintWarnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber leading-relaxed">⚠ {w}</p>
                ))}
              </div>
            )}
            {/* 渲染预览 */}
            <div className="shrink-0">
              <p className="text-xs font-medium text-body-strong mb-1.5">渲染预览</p>
              <div className="rounded-lg border border-hairline bg-surface-card px-4 py-3 max-h-40 overflow-auto">
                <AnnotatedContent content={content} />
              </div>
            </div>
          </div>
          {linkedCardCount > 0 && contentChanged && (
            <p className="text-xs text-muted-soft shrink-0">
              提示：该块已有 {linkedCardCount} 张卡片。修改内容后重新生成该块卡片即可更新卡面，已有复习进度会保留。
            </p>
          )}
        </div>

        {/* Footer — 移动端贴近安全区 */}
        <div className="px-5 lg:px-6 py-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] lg:pb-4 border-t border-hairline flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 lg:py-2 text-sm text-muted font-medium hover:text-ink transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-5 py-2.5 bg-coral text-on-primary rounded-lg text-sm font-medium hover:bg-coral-active transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
