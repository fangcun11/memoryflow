import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, PenLine, Target, Layers, Play } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import { getDashboardStats, TIER_LABELS, TIER_ORDER } from '@memoryflow/core'
import type { CardTier } from '@memoryflow/core'

/** 分层堆叠条配色 */
const TIER_COLORS: Record<CardTier, { bar: string; text: string; bg: string }> = {
  new: { bar: 'bg-teal', text: 'text-teal', bg: 'bg-teal-light' },
  learning: { bar: 'bg-amber', text: 'text-amber', bg: 'bg-amber-light' },
  familiar: { bar: 'bg-blue', text: 'text-blue', bg: 'bg-blue-light' },
  mastered: { bar: 'bg-success', text: 'text-success', bg: 'bg-success-light' },
  hard: { bar: 'bg-error', text: 'text-error', bg: 'bg-error-light' },
}

/** 热力图色阶（珊瑚色系，与主题一致） */
const HEAT_EMPTY = '#efe9df'
function heatColor(count: number, max: number): string {
  if (count <= 0) return HEAT_EMPTY
  const ratio = count / max
  if (ratio > 0.75) return '#d85a30'
  if (ratio > 0.5) return 'rgba(216,90,48,0.75)'
  if (ratio > 0.25) return 'rgba(216,90,48,0.5)'
  return 'rgba(216,90,48,0.28)'
}

export default function DashboardView() {
  const navigate = useNavigate()
  const { cards, blocks, documents, reviewLogs, tags, settings, startReview } = useStore()
  const stats = useMemo(
    () => getDashboardStats({ cards, blocks, tags, reviewLogs, settings }),
    [cards, blocks, tags, reviewLogs, settings]
  )
  const maxHeat = Math.max(...stats.heatmap.map(d => d.count), 1)
  const maxForecast = Math.max(...stats.forecast.map(d => d.count), 1)
  const weakTags = stats.tagWeakness.filter(t => t.accuracy < 0 || t.accuracy < 70).slice(0, 5)

  // 热力图按周分列（GitHub 式，每列 7 天，列首对齐到周日）
  const heatColumns = useMemo(() => {
    const cols: { date: string; count: number }[][] = []
    for (let i = 0; i < stats.heatmap.length; i += 7) {
      cols.push(stats.heatmap.slice(i, i + 7))
    }
    return cols
  }, [stats.heatmap])

  const goToTier = (tier: CardTier) => navigate(`/?tier=${tier}`)

  const reviewByTag = (tagName: string) => {
    startReview(tagName)
    navigate('/review')
  }

  return (
    <div className="h-full overflow-auto p-4 lg:p-8">
      <header className="mb-6 lg:mb-8">
        <h2 className="font-serif text-2xl lg:text-[1.75rem] font-medium text-ink tracking-tight">学习看板</h2>
        <p className="text-sm text-muted mt-1">记忆状态、复习负载与薄弱环节</p>
      </header>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
        <OverviewCard label="连续学习" value={`${stats.today.streak}`} unit="天" icon={<Flame className="w-5 h-5 text-coral" />} iconBg="bg-coral-light" />
        <OverviewCard label="今日已学" value={`${stats.today.reviewed}`} unit="张" icon={<PenLine className="w-5 h-5 text-teal" />} iconBg="bg-teal-light" />
        <OverviewCard label="已掌握" value={`${stats.totals.masteredRate}`} unit="%" icon={<Target className="w-5 h-5 text-success" />} iconBg="bg-success-light" />
        <OverviewCard label="累计复习" value={`${stats.totals.reviews}`} unit="次" icon={<Layers className="w-5 h-5 text-amber" />} iconBg="bg-amber-light" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {/* 记忆状态分层 */}
        <div className="bg-surface-card border border-hairline rounded-xl p-6">
          <h3 className="font-serif text-base font-medium text-ink mb-4">记忆状态</h3>
          <div className="flex h-3 rounded-full overflow-hidden mb-4 bg-surface-soft">
            {TIER_ORDER.map(tier =>
              stats.tiers[tier] > 0 ? (
                <div
                  key={tier}
                  className={`${TIER_COLORS[tier].bar} transition-all duration-500`}
                  style={{ width: `${(stats.tiers[tier] / Math.max(stats.totals.cards, 1)) * 100}%` }}
                />
              ) : null
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TIER_ORDER.map(tier => (
              <button
                key={tier}
                onClick={() => goToTier(tier)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border border-hairline ${TIER_COLORS[tier].bg} hover:shadow-sm active:scale-[0.98] transition-all text-left`}
                title={`在卡片视图中查看${TIER_LABELS[tier]}`}
              >
                <span className={`text-xs font-medium ${TIER_COLORS[tier].text}`}>{TIER_LABELS[tier]}</span>
                <span className={`text-sm font-bold ${TIER_COLORS[tier].text}`}>{stats.tiers[tier]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 未来 14 天到期预测 */}
        <div className="bg-surface-card border border-hairline rounded-xl p-6">
          <h3 className="font-serif text-base font-medium text-ink mb-4">未来 14 天复习负载</h3>
          <div className="flex items-end gap-1 h-32">
            {stats.forecast.map((d, i) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <span className="text-[10px] text-muted">{d.count || ''}</span>
                <div
                  className={`w-full rounded-t-md transition-all duration-300 min-h-[3px] ${i === 0 ? 'bg-coral' : 'bg-coral/50'}`}
                  style={{ height: `${(d.count / maxForecast) * 100}%` }}
                  title={`${d.label}：${d.count} 张到期`}
                />
                <span className="text-[9px] text-muted-soft truncate w-full text-center">{d.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-soft mt-3">
            今天到期待处理 <span className="text-coral font-medium">{stats.forecast[0]?.count ?? 0}</span> 张（含逾期）
          </p>
        </div>
      </div>

      {/* 热力图 */}
      <div className="bg-surface-card border border-hairline rounded-xl p-6 mb-6 lg:mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-base font-medium text-ink">复习热力图 · 近 15 周</h3>
          <div className="flex items-center gap-1 text-[10px] text-muted-soft">
            少
            {[0, 1, 3, 6, 10].map(c => (
              <span key={c} className="w-3 h-3 rounded-[3px] inline-block" style={{ backgroundColor: heatColor(c, 10) }} />
            ))}
            多
          </div>
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-[3px] min-w-max">
            {heatColumns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[3px]">
                {col.map(day => (
                  <span
                    key={day.date}
                    className="w-3 h-3 rounded-[3px] inline-block"
                    style={{ backgroundColor: heatColor(day.count, maxHeat) }}
                    title={`${day.date}：${day.count > 0 ? `${day.count} 次复习` : '未学习'}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-soft mt-3">
          连续学习 {stats.today.streak} 天 · 累计 {stats.totals.reviews} 次
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {/* 近7天趋势 */}
        <WeeklyTrend reviewLogs={reviewLogs} />

        {/* 薄弱标签清单 */}
        <div className="bg-surface-card border border-hairline rounded-xl p-6">
          <h3 className="font-serif text-base font-medium text-ink mb-4">薄弱环节</h3>
          {weakTags.length === 0 ? (
            <p className="text-sm text-muted-soft text-center py-8">各标签掌握良好，继续保持</p>
          ) : (
            <div className="space-y-2.5">
              {weakTags.map(t => (
                <div key={t.name} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-soft">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-body-strong">{t.name}</span>
                      <span className={`text-xs font-medium ${t.accuracy < 0 ? 'text-muted-soft' : 'text-error'}`}>
                        {t.accuracy < 0 ? '未复习' : `正确率 ${t.accuracy}%`}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-card rounded-full overflow-hidden">
                      <div
                        className="h-full bg-error/60 rounded-full"
                        style={{ width: `${t.accuracy >= 0 ? t.accuracy : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-soft">{t.cardCount} 张卡 · {t.reviewCount} 次复习</span>
                  </div>
                  <button
                    onClick={() => reviewByTag(t.name)}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-coral text-on-primary text-xs font-medium hover:bg-coral-active active:scale-95 transition-all"
                    title={`只复习「${t.name}」标签下的卡片`}
                  >
                    <Play className="w-3 h-3" strokeWidth={2.5} />
                    去复习
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 文档掌握度 */}
      <div className="bg-surface-card border border-hairline rounded-xl p-6">
        <h3 className="font-serif text-base font-medium text-ink mb-4">已导入文档</h3>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-soft text-center py-4">暂无文档</p>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => {
              const docCards = cards.filter(c =>
                blocks.some(b => b.documentId === doc.id && b.id === c.blockId)
              )
              const mastered = docCards.filter(c => c.interval >= 21).length
              const pct = docCards.length > 0 ? Math.round((mastered / docCards.length) * 100) : 0
              return (
                <div key={doc.id} className="flex items-center gap-4 px-4 py-3 bg-surface-soft rounded-lg">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-body-strong truncate">{doc.title}</span>
                      <span className="text-xs text-muted-soft shrink-0 ml-2">
                        {docCards.length} 卡 · 掌握 {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-card rounded-full overflow-hidden">
                      <div className="h-full bg-success/60 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-muted-soft shrink-0">{new Date(doc.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function WeeklyTrend({ reviewLogs }: { reviewLogs: { reviewedAt: number; rating: number }[] }) {
  const days = useMemo(() => {
    const out: { date: string; count: number; correct: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const start = new Date(d); start.setHours(0, 0, 0, 0)
      const end = new Date(d); end.setHours(23, 59, 59, 999)
      const logs = reviewLogs.filter(l => l.reviewedAt >= start.getTime() && l.reviewedAt <= end.getTime())
      out.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        count: logs.length,
        correct: logs.length > 0 ? Math.round((logs.filter(l => l.rating >= 2).length / logs.length) * 100) : 0,
      })
    }
    return out
  }, [reviewLogs])
  const max = Math.max(...days.map(d => d.count), 1)
  const weekTotal = days.reduce((s, d) => s + d.count, 0)

  return (
    <div className="bg-surface-card border border-hairline rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-base font-medium text-ink">近 7 天复习趋势</h3>
        <span className="text-xs text-muted-soft">共 {weekTotal} 次</span>
      </div>
      <div className="flex items-end gap-2 h-40">
        {days.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-muted">{d.count}</span>
            <div
              className="w-full bg-coral rounded-t-md transition-all duration-300 min-h-[4px]"
              style={{ height: `${(d.count / max) * 100}%`, opacity: 0.3 + (d.count / max) * 0.7 }}
              title={`${d.date}：${d.count} 次${d.count > 0 ? ` · 正确率 ${d.correct}%` : ''}`}
            />
            <span className="text-xs text-muted-soft">{d.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function OverviewCard({ label, value, unit, icon, iconBg }: {
  label: string; value: string; unit: string; icon: ReactNode; iconBg: string
}) {
  return (
    <div className="bg-surface-card border border-hairline rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-ink">
        {value}
        <span className="text-sm font-normal text-muted ml-1">{unit}</span>
      </div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  )
}
