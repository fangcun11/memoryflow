import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import type { KnowledgeBlock } from '@memoryflow/core'
import TagEditor from './TagEditor'

interface Props {
  blocks: KnowledgeBlock[]
  selectedIds: string[]
  onToggleSelect: (id: string) => void
}

export default function BlockList({ blocks, selectedIds, onToggleSelect }: Props) {
  return (
    <div className="space-y-3">
      {blocks.map(block => (
        <BlockCard
          key={block.id}
          block={block}
          selected={selectedIds.includes(block.id)}
          onToggleSelect={() => onToggleSelect(block.id)}
        />
      ))}
    </div>
  )
}

function BlockCard({
  block,
  selected,
  onToggleSelect,
}: {
  block: KnowledgeBlock
  selected: boolean
  onToggleSelect: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingTags, setEditingTags] = useState(false)
  const [editingContent, setEditingContent] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const tags = useStore(s => s.tags)
  const cards = useStore(s => s.cards)
  const deleteBlock = useStore(s => s.deleteBlock)
  const updateBlockContent = useStore(s => s.updateBlockContent)

  const linkedCardCount = cards.filter(c => c.blockId === block.id).length

  function startEdit() {
    setDraftTitle(block.title ?? '')
    setDraftContent(block.content)
    setEditingContent(true)
  }

  function saveEdit() {
    if (!draftContent.trim()) return
    updateBlockContent(block.id, draftContent, draftTitle)
    setEditingContent(false)
  }

  return (
    <div
      className={`group rounded-xl transition-all duration-150 cursor-pointer ${
        selected
          ? 'bg-surface-card shadow-md border border-coral/30'
          : 'bg-surface-card border border-hairline hover:border-muted-soft/40 hover:shadow-sm'
      }`}
      onClick={onToggleSelect}
    >
      <div className="p-4 lg:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                selected
                  ? 'bg-coral text-on-primary'
                  : 'border border-hairline group-hover:border-muted-soft'
              }`}
            >
              {selected && (
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
              )}
            </div>
            {block.title && (
              <h4 className="font-medium text-body-strong text-sm">{block.title}</h4>
            )}
          </div>
          <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={e => {
                e.stopPropagation()
                if (editingContent) {
                  setEditingContent(false)
                } else {
                  startEdit()
                }
              }}
              className="w-9 h-9 lg:w-7 lg:h-7 rounded-lg hover:bg-surface-soft active:bg-surface-soft flex items-center justify-center text-muted-soft hover:text-body transition-colors"
              title="编辑内容"
            >
              {editingContent ? (
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              ) : (
                <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
            </button>
            <button
              onClick={e => {
                e.stopPropagation()
                if (confirm('确定删除此知识块？')) deleteBlock(block.id)
              }}
              className="w-9 h-9 lg:w-7 lg:h-7 rounded-lg hover:bg-error-light active:bg-error-light flex items-center justify-center text-muted-soft hover:text-error transition-colors"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Content / Content Editor */}
        {editingContent ? (
          <div
            className="space-y-2"
            onClick={e => e.stopPropagation()}
          >
            <input
              value={draftTitle}
              onChange={e => setDraftTitle(e.target.value)}
              placeholder="标题（可留空）"
              className="w-full px-3 py-2 rounded-lg border border-hairline bg-surface-soft text-sm text-body-strong placeholder:text-muted-soft/60 focus:outline-none focus:border-coral/50"
            />
            <textarea
              value={draftContent}
              onChange={e => setDraftContent(e.target.value)}
              rows={Math.min(12, Math.max(4, Math.ceil(draftContent.length / 40)))}
              className="w-full px-3 py-2 rounded-lg border border-hairline bg-surface-soft text-sm text-body leading-relaxed resize-y focus:outline-none focus:border-coral/50"
            />
            <div className="flex items-center justify-between gap-2">
              {linkedCardCount > 0 && (
                <span className="text-xs text-muted-soft">
                  该块已有 {linkedCardCount} 张卡片，内容变更后卡片不会自动更新，可在下方重新生成
                </span>
              )}
              <div className="flex gap-2 ml-auto shrink-0">
                <button
                  onClick={() => setEditingContent(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-soft hover:bg-surface-soft transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={saveEdit}
                  disabled={!draftContent.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-coral text-on-primary hover:bg-coral-active disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p
              className={`text-sm text-body leading-relaxed whitespace-pre-wrap ${
                expanded ? '' : 'line-clamp-3'
              }`}
              onClick={e => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
            >
              {block.content}
            </p>
            {block.content.length > 150 && (
              <button
                onClick={e => {
                  e.stopPropagation()
                  setExpanded(!expanded)
                }}
                className="text-xs text-coral hover:text-coral-active mt-1.5 font-medium transition-colors"
              >
                {expanded ? '收起' : '展开全文'}
              </button>
            )}
          </>
        )}

        {/* Tags */}
        {block.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {block.tags.map(tagName => (
              <span
                key={tagName}
                className="px-2.5 py-0.5 bg-surface-soft text-muted rounded-md text-xs font-medium"
              >
                {tagName}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tag Editor */}
      {editingTags && (
        <div
          className="px-5 pb-4 border-t border-hairline-soft"
          onClick={e => e.stopPropagation()}
        >
          <TagEditor
            blockId={block.id}
            currentTags={block.tags}
            allTags={tags}
            onClose={() => setEditingTags(false)}
          />
        </div>
      )}
    </div>
  )
}
