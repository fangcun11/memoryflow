import { useState, useEffect, useRef } from 'react'
import { Pencil, Trash2, Check } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import { stripAnnotationTags } from '@memoryflow/core'
import type { KnowledgeBlock } from '@memoryflow/core'
import TagEditor from './TagEditor'
import EditBlockModal from './EditBlockModal'
import AnnotatedContent from './AnnotatedContent'
import ConfirmDialog from '../../components/ConfirmDialog'
import { toast } from '../../components/toast'

/** 块级难卡聚合统计（复习表现回流知识库） */
export interface BlockHardStat {
  hard: number
  total: number
}

interface Props {
  blocks: KnowledgeBlock[]
  selectedIds: string[]
  onToggleSelect: (id: string) => void
  hardStats?: Record<string, BlockHardStat>
  highlightId?: string | null // 从复习页"查看来源块"跳转而来
}

export default function BlockList({ blocks, selectedIds, onToggleSelect, hardStats, highlightId }: Props) {
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
          hardStat={hardStats?.[block.id]}
          highlighted={highlightId === block.id}
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
            toast('知识块及其卡片已删除')
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
  hardStat,
  highlighted = false,
}: {
  block: KnowledgeBlock
  selected: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onDelete: () => void
  hardStat?: BlockHardStat
  highlighted?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingTags, setEditingTags] = useState(false)
  const tags = useStore(s => s.tags)
  const cardRef = useRef<HTMLDivElement>(null)

  // 从复习页跳转而来：滚动到可见并短暂高亮
  useEffect(() => {
    if (!highlighted) return
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlighted])

  return (
    <div
      ref={cardRef}
      className={`group rounded-xl transition-all duration-150 cursor-pointer ${
        highlighted
          ? 'bg-surface-card shadow-md border border-coral ring-2 ring-coral/40'
          : selected
          ? 'bg-surface-card shadow-md border border-coral/30'
          : 'bg-surface-card border border-hairline hover:border-muted-soft/40 hover:shadow-sm'
      }`}
      onClick={onToggleSelect}
    >
      <div className="p-4 lg:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-5 h-5 rounded flex items-center justify-center transition-all shrink-0 ${
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
              <h4 className="font-medium text-body-strong text-sm">
                {/* 存量数据标题可能携带标注痕迹，显示时剥离 */}
                {stripAnnotationTags(block.title).slice(0, 30)}
              </h4>
            )}
            {hardStat && hardStat.hard > 0 && (
              <span
                className="shrink-0 px-2 py-0.5 rounded-md bg-amber-light text-amber text-[11px] font-medium"
                title={`${hardStat.hard} 张难卡（多次忘记或容易度低），建议回来补充标注或拆分`}
              >
                难卡 {hardStat.hard}/{hardStat.total}
              </span>
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

        {/* Content — 渲染视图：高亮/批注/标注标签样式化，原文只在编辑弹层 */}
        <div
          className={`text-sm text-body leading-relaxed ${
            expanded ? '' : 'line-clamp-6'
          }`}
          onClick={e => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
        >
          <AnnotatedContent content={block.content} annotations={block.annotations} />
        </div>
        {(block.content.length > 150 || block.annotations?.length) && (
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
