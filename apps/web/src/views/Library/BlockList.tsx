import { useState } from 'react'
import { Pencil, Trash2, Check } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import type { KnowledgeBlock } from '@memoryflow/core'
import TagEditor from './TagEditor'
import EditBlockModal from './EditBlockModal'
import ConfirmDialog from '../../components/ConfirmDialog'

interface Props {
  blocks: KnowledgeBlock[]
  selectedIds: string[]
  onToggleSelect: (id: string) => void
}

export default function BlockList({ blocks, selectedIds, onToggleSelect }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const deleteBlock = useStore(s => s.deleteBlock)
  const editingBlock = blocks.find(b => b.id === editingId) ?? null
  const deletingBlock = blocks.find(b => b.id === deletingId) ?? null

  return (
    <div className="space-y-3">
      {blocks.map(block => (
        <BlockCard
          key={block.id}
          block={block}
          selected={selectedIds.includes(block.id)}
          onToggleSelect={() => onToggleSelect(block.id)}
          onEdit={() => setEditingId(block.id)}
          onDelete={() => setDeletingId(block.id)}
        />
      ))}

      {editingBlock && (
        <EditBlockModal block={editingBlock} onClose={() => setEditingId(null)} />
      )}

      {deletingBlock && (
        <ConfirmDialog
          title="删除这个知识块？"
          message={`「${deletingBlock.title || deletingBlock.content.slice(0, 30)}」及其生成的卡片将一并删除，不可恢复。`}
          confirmText="删除"
          danger
          onConfirm={() => {
            deleteBlock(deletingBlock.id)
            setDeletingId(null)
          }}
          onClose={() => setDeletingId(null)}
        />
      )}
    </div>
  )
}

function BlockCard({
  block,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  block: KnowledgeBlock
  selected: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingTags, setEditingTags] = useState(false)
  const tags = useStore(s => s.tags)

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
                onEdit()
              }}
              className="w-9 h-9 lg:w-7 lg:h-7 rounded-lg hover:bg-surface-soft active:bg-surface-soft flex items-center justify-center text-muted-soft hover:text-body transition-colors"
              title="编辑内容"
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              onClick={e => {
                e.stopPropagation()
                onDelete()
              }}
              className="w-9 h-9 lg:w-7 lg:h-7 rounded-lg hover:bg-error-light active:bg-error-light flex items-center justify-center text-muted-soft hover:text-error transition-colors"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Content */}
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
