import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import { formatInterval } from '@memoryflow/core'
import type { Card } from '@memoryflow/core'

/** 卡片类型徽标（与 ReviewView TYPE_BADGE 同源配色） */
const TYPE_BADGE: Record<string, { label: string; classes: string }> = {
  qa: { label: '问答', classes: 'bg-teal-light text-teal' },
  cloze: { label: '填空', classes: 'bg-amber-light text-amber' },
  essay: { label: '论述', classes: 'bg-success-light text-success' },
  compare: { label: '对比', classes: 'bg-coral-light text-coral' },
  recall: { label: '名解', classes: 'bg-blue-light text-blue' },
  choice: { label: '选择', classes: 'bg-coral-light text-coral' },
  judge: { label: '判断', classes: 'bg-blue-light text-blue' },
}

/** 卡片状态徽标：颜色之外带文字，不以颜色为唯一信息载体 */
function statusBadge(card: Card): { label: string; classes: string } | null {
  const now = Date.now()
  if (card.repetitions === 0) return { label: '新卡', classes: 'bg-success-light text-success' }
  if (card.dueDate <= now) return { label: '到期', classes: 'bg-teal-light text-teal' }
  return { label: `下次 ${formatInterval(card.interval)}`, classes: 'bg-surface-soft text-muted' }
}

/** 找到卡片来源知识块的标题（front 截断展示时补上下文） */
function blockTitleOf(card: Card, titles: Map<string, string | undefined>): string {
  return titles.get(card.blockId) ?? ''
}

interface Props {
  cards: Card[]
}

export default function CardList({ cards }: Props) {
  const blocks = useStore(s => s.blocks)
  const deleteCard = useStore(s => s.deleteCard)
  const titles = new Map(blocks.map(b => [b.id, b.title]))
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-soft flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-muted-soft"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 6h12M6 10h12M6 14h12M6 18h6"
            />
          </svg>
        </div>
        <h3 className="font-serif text-lg font-medium text-ink mb-1">还没有卡片</h3>
        <p className="text-muted text-sm max-w-xs leading-relaxed">
          切回知识块视图，选中块后点底部「生成卡片」
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {cards.map(card => {
        const badge = TYPE_BADGE[card.type] ?? { label: card.type, classes: 'bg-surface-soft text-muted' }
        const status = statusBadge(card)
        const expanded = expandedId === card.id
        return (
          <div
            key={card.id}
            className="group rounded-xl bg-surface-card border border-hairline hover:border-muted-soft/40 hover:shadow-sm transition-all duration-150"
          >
            <div className="p-4 lg:p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium ${badge.classes}`}>
                    {badge.label}
                  </span>
                  {status && (
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium ${status.classes}`}>
                      {status.label}
                    </span>
                  )}
                  <span className="text-xs text-muted-soft hidden sm:inline">
                    {card.repetitions > 0 ? `已复习 ${card.repetitions} 次` : '未复习'}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      if (confirm('确定删除此卡片？该卡片的复习进度将一并移除。')) deleteCard(card.id)
                    }}
                    className="w-9 h-9 lg:w-7 lg:h-7 rounded-lg hover:bg-error-light active:bg-error-light flex items-center justify-center text-muted-soft hover:text-error transition-colors"
                    title="删除卡片"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              <p
                className={`text-sm text-body leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-2'}`}
                onClick={() => setExpandedId(expanded ? null : card.id)}
              >
                {card.front}
              </p>

              {/* 背面内容：展开后可见，平时隐藏避免剧透 */}
              {expanded && (
                <div className="mt-2 pt-2 border-t border-hairline-soft">
                  <p className="text-xs text-muted-soft mb-1">背面</p>
                  <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{card.back}</p>
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-soft/70">
                  {blockTitleOf(card, titles) && `来自：${blockTitleOf(card, titles)}`}
                </span>
                <button
                  onClick={() => setExpandedId(expanded ? null : card.id)}
                  className="text-xs text-coral hover:text-coral-active font-medium transition-colors"
                >
                  {expanded ? '收起' : card.front.length > 50 ? '查看' : '查看背面'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
