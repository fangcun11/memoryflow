import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import type { KnowledgeBlock } from '@memoryflow/core'

interface Props {
  block: KnowledgeBlock
  onClose: () => void
}

/**
 * 编辑知识块弹层
 * 复用 ImportModal 的响应式壳：移动端 Bottom Sheet / 桌面端居中弹窗
 */
export default function EditBlockModal({ block, onClose }: Props) {
  const updateBlockContent = useStore(s => s.updateBlockContent)
  const cards = useStore(s => s.cards)
  const [title, setTitle] = useState(block.title ?? '')
  const [content, setContent] = useState(block.content)

  const linkedCardCount = cards.filter(c => c.blockId === block.id).length
  const contentChanged = content.trim() !== block.content
  const canSave = content.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    updateBlockContent(block.id, content, title)
    onClose()
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
            <label className="text-sm font-medium text-body-strong mb-1.5 shrink-0">内容</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={Math.min(16, Math.max(6, Math.ceil(content.length / 40)))}
              className="w-full flex-1 min-h-[180px] px-4 py-3 bg-surface-card border border-hairline rounded-lg text-sm text-ink resize-y focus:outline-none focus:border-coral focus:shadow-ring-focus transition-all leading-relaxed"
            />
          </div>
          {linkedCardCount > 0 && contentChanged && (
            <p className="text-xs text-muted-soft shrink-0">
              提示：该块已有 {linkedCardCount} 张卡片，修改内容后卡片不会自动更新，可重新生成该块卡片。
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
