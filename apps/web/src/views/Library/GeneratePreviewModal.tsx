import { useState } from 'react'
import { X, Sparkles, Wand2, AlertTriangle } from 'lucide-react'
import type { CardPreview } from '@memoryflow/core'

interface Props {
  previews: CardPreview[]
  blockTitles: Record<string, string>
  onCancel: () => void
  onConfirm: (selected: CardPreview[]) => void
}

/** 预览质量徽标 */
const QUALITY_BADGE: Record<CardPreview['quality'], { label: string; cls: string; icon: typeof Sparkles }> = {
  annotated: { label: '标注', cls: 'bg-coral-light text-coral', icon: Sparkles },
  ok: { label: '规则', cls: 'bg-teal-light text-teal', icon: Wand2 },
  low: { label: '建议人工', cls: 'bg-amber-light text-amber', icon: AlertTriangle },
}

/**
 * 生成预览确认层：列出将产生的卡片，低质量兜底卡默认不勾选，
 * 确认后只物化勾选的卡片（同身份重出卡由 core 合并更新）。
 */
export default function GeneratePreviewModal({ previews, blockTitles, onCancel, onConfirm }: Props) {
  // 用索引做勾选 key（同一张卡内容可能重复出现）；低质量兜底卡默认不勾选
  const [selected, setSelected] = useState<Set<number>>(() => {
    const s = new Set<number>()
    previews.forEach((p, i) => {
      if (p.quality !== 'low') s.add(i)
    })
    return s
  })

  const toggle = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const lowCount = previews.filter(p => p.quality === 'low' && !selected.has(previews.indexOf(p))).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-ink/20 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="sheet-up lg:animate-none bg-canvas rounded-t-2xl sm:rounded-2xl w-full lg:max-w-2xl lg:max-h-[85vh] h-full sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden sm:m-6"
        style={{ boxShadow: '0 8px 24px #14141320' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 lg:px-6 py-4 border-b border-hairline flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-serif text-lg font-medium text-ink">预览生成的卡片</h3>
            <p className="text-xs text-muted-soft mt-0.5">
              共 {previews.length} 张 · 已选 {selected.size} 张
              {lowCount > 0 && ` · ${lowCount} 张低质量卡未勾选`}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-lg hover:bg-surface-soft active:bg-surface-soft flex items-center justify-center text-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-auto p-4 lg:p-6 space-y-2">
          {previews.map((p, i) => {
            const badge = QUALITY_BADGE[p.quality]
            const checked = selected.has(i)
            const blockTitle = blockTitles[p.card.blockId]
            return (
              <button
                key={i}
                onClick={() => toggle(i)}
                className={`w-full text-left rounded-xl border p-3.5 transition-all active:scale-[0.99] ${
                  checked ? 'border-coral/50 bg-coral-faint' : 'border-hairline bg-surface-card opacity-70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 w-5 h-5 shrink-0 rounded border flex items-center justify-center text-[10px] font-bold ${
                      checked ? 'bg-coral border-coral text-on-primary' : 'border-muted-soft'
                    }`}
                  >
                    {checked ? '✓' : ''}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="text-[11px] text-muted-soft truncate">
                        {blockTitle ? `来自：${blockTitle}` : ''}
                      </span>
                    </div>
                    <p className="text-sm text-ink line-clamp-2 leading-relaxed">{p.card.front}</p>
                    {p.note && (
                      <p className="text-[11px] text-amber mt-1 leading-relaxed">{p.note}</p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 lg:px-6 py-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] lg:pb-4 border-t border-hairline flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 lg:py-2 text-sm text-muted font-medium hover:text-ink transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(previews.filter((_, i) => selected.has(i)))}
            disabled={selected.size === 0}
            className="px-5 py-2.5 bg-coral text-on-primary rounded-lg text-sm font-medium hover:bg-coral-active transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            生成 {selected.size} 张卡片
          </button>
        </div>
      </div>
    </div>
  )
}
