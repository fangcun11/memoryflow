import { useState } from 'react'
import type { CardType } from '@memoryflow/core'

interface Props {
  selectedCount: number
  onGenerate: (types: CardType[]) => void
  onClear: () => void
}

/**
 * 批量生成操作条
 * - 移动端：static 常驻在内容底部（Tab Bar 上方），纵向堆叠 + 卡型横滑
 * - 桌面端：fixed 悬浮在底部，与原版一致
 */
export default function GeneratePanel({ selectedCount, onGenerate, onClear }: Props) {
  const [types, setTypes] = useState<CardType[]>(['qa', 'cloze'])

  const toggleType = (type: CardType) => {
    setTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const typeOptions: { type: CardType; label: string; desc: string }[] = [
    { type: 'qa', label: '问答卡', desc: '概念定义' },
    { type: 'cloze', label: '填空卡', desc: '挖空关键词' },
    { type: 'essay', label: '论述卡', desc: '要点框架' },
  ]

  return (
    <div
      className="static lg:fixed bottom-0 inset-x-0 lg:left-60 z-40 bg-canvas/95 backdrop-blur-lg border-t border-hairline"
      style={{ boxShadow: '0 -4px 16px #14141308' }}
    >
      <div className="max-w-4xl mx-auto px-4 lg:px-6 py-3 lg:py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3 lg:gap-4 min-w-0">
          <span className="text-sm font-medium text-body-strong whitespace-nowrap shrink-0">
            已选 <span className="text-coral font-bold">{selectedCount}</span> 个知识块
          </span>
          <div className="flex items-center gap-2 overflow-x-auto">
            {typeOptions.map(opt => (
              <button
                key={opt.type}
                onClick={() => toggleType(opt.type)}
                className={`shrink-0 px-3 py-2 lg:py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                  types.includes(opt.type)
                    ? 'bg-coral text-on-primary shadow-sm'
                    : 'bg-surface-soft text-body hover:bg-surface-strong'
                }`}
              >
                {opt.label}
                <span className="ml-1 opacity-70 hidden sm:inline">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onClear}
            className="px-4 py-2 text-sm text-muted font-medium hover:text-ink transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onGenerate(types)}
            disabled={types.length === 0}
            className="flex-1 lg:flex-none px-5 py-2.5 bg-coral text-on-primary rounded-lg text-sm font-medium hover:bg-coral-active transition-colors shadow-sm disabled:opacity-40"
          >
            生成卡片
          </button>
        </div>
      </div>
    </div>
  )
}
