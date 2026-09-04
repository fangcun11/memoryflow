import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Flame, PenLine, LibraryBig, Puzzle } from 'lucide-react'
import { useStore } from '../../stores/useStore'

export default function DashboardView() {
  const { cards, blocks, documents, reviewLogs, tags, getReviewStats } = useStore()
  const stats = getReviewStats()

  const tagStats = useMemo(() => {
    return tags
      .map(tag => {
        const tagBlocks = blocks.filter(b => b.tags.includes(tag.name))
        const tagCards = cards.filter(c => tagBlocks.some(b => b.id === c.blockId))
        const tagLogs = reviewLogs.filter(l => tagCards.some(c => c.id === l.cardId))
        const correct = tagLogs.filter(l => l.rating >= 3).length
        const total = tagLogs.length
        return {
          name: tag.name,
          cardCount: tagCards.length,
          reviewCount: total,
          accuracy: total > 0 ? Math.round((correct / total) * 100) : -1,
        }
      })
      .filter(t => t.cardCount > 0)
      .sort((a, b) => b.reviewCount - a.reviewCount)
  }, [tags, blocks, cards, reviewLogs])

  const weeklyData = useMemo(() => {
    const days: { date: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const start = new Date(d); start.setHours(0, 0, 0, 0)
      const end = new Date(d); end.setHours(23, 59, 59, 999)
      const count = reviewLogs.filter(l => l.reviewedAt >= start.getTime() && l.reviewedAt <= end.getTime()).length
      days.push({ date: `${d.getMonth() + 1}/${d.getDate()}`, count })
    }
    return days
  }, [reviewLogs])

  const cardStatus = useMemo(() => {
    const now = Date.now()
    return {
      due: cards.filter(c => c.dueDate <= now && c.repetitions > 0).length,
      new: cards.filter(c => c.repetitions === 0).length,
      learning: cards.filter(c => c.repetitions > 0 && c.dueDate > now).length,
    }
  }, [cards])

  const maxWeekly = Math.max(...weeklyData.map(d => d.count), 1)

  return (
    <div className="h-full overflow-auto p-4 lg:p-8">
      <header className="mb-6 lg:mb-8">
        <h2 className="font-serif text-2xl lg:text-[1.75rem] font-medium text-ink tracking-tight">学习看板</h2>
        <p className="text-sm text-muted mt-1">跟踪你的学习进度和记忆状态</p>
      </header>

      {/* Overview Cards — 移动端 2 列 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
        <OverviewCard label="连续学习" value={`${stats.streak}`} unit="天" icon={<Flame className="w-5 h-5 text-coral" />} iconBg="bg-coral-light" />
        <OverviewCard label="今日已学" value={`${stats.reviewed}`} unit="张" icon={<PenLine className="w-5 h-5 text-teal" />} iconBg="bg-teal-light" />
        <OverviewCard label="总卡片数" value={`${cards.length}`} unit="张" icon={<LibraryBig className="w-5 h-5 text-body" />} iconBg="bg-surface-soft" />
        <OverviewCard label="知识块" value={`${blocks.length}`} unit="个" icon={<Puzzle className="w-5 h-5 text-amber" />} iconBg="bg-amber-light" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {/* Weekly Trend */}
        <div className="bg-surface-card border border-hairline rounded-xl p-6">
          <h3 className="font-serif text-base font-medium text-ink mb-4">近7天复习趋势</h3>
          <div className="flex items-end gap-2 h-40">
            {weeklyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-muted">{d.count}</span>
                <div
                  className="w-full bg-coral rounded-t-md transition-all duration-300 min-h-[4px]"
                  style={{ height: `${(d.count / maxWeekly) * 100}%`, opacity: 0.3 + (d.count / maxWeekly) * 0.7 }}
                />
                <span className="text-xs text-muted-soft">{d.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card Status */}
        <div className="bg-surface-card border border-hairline rounded-xl p-6">
          <h3 className="font-serif text-base font-medium text-ink mb-4">卡片状态</h3>
          <div className="space-y-4">
            <StatusBar label="待复习" count={cardStatus.due} total={cards.length} color="bg-coral" />
            <StatusBar label="新卡片" count={cardStatus.new} total={cards.length} color="bg-teal" />
            <StatusBar label="学习中" count={cardStatus.learning} total={cards.length} color="bg-amber" />
          </div>
        </div>
      </div>

      {/* Tag Mastery */}
      <div className="bg-surface-card border border-hairline rounded-xl p-6 mb-8">
        <h3 className="font-serif text-base font-medium text-ink mb-4">标签掌握度</h3>
        {tagStats.length === 0 ? (
          <p className="text-sm text-muted-soft text-center py-8">暂无数据，先给知识块打标签并开始复习吧</p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {tagStats.map(t => (
              <div key={t.name} className="heatmap-cell rounded-lg p-4 border border-hairline text-center" style={{ backgroundColor: getHeatColor(t.accuracy) }}>
                <div className="text-sm font-medium text-ink">{t.name}</div>
                <div className="text-xs text-muted mt-1">{t.accuracy >= 0 ? `${t.accuracy}%` : '未复习'}</div>
                <div className="text-[10px] text-muted-soft mt-0.5">{t.cardCount}卡 · {t.reviewCount}次</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="bg-surface-card border border-hairline rounded-xl p-6">
        <h3 className="font-serif text-base font-medium text-ink mb-4">已导入文档</h3>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-soft text-center py-4">暂无文档</p>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => {
              const docBlocks = blocks.filter(b => b.documentId === doc.id)
              return (
                <div key={doc.id} className="flex items-center justify-between px-4 py-3 bg-surface-soft rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-body-strong">{doc.title}</span>
                    <span className="text-xs text-muted ml-2">{docBlocks.length} 个知识块</span>
                  </div>
                  <span className="text-xs text-muted-soft">{new Date(doc.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              )
            })}
          </div>
        )}
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

function StatusBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-body">{label}</span>
        <span className="font-medium text-body-strong">{count}</span>
      </div>
      <div className="h-2 bg-surface-soft rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function getHeatColor(accuracy: number): string {
  if (accuracy < 0) return '#f5f0e8'  // 未复习 — surface-soft
  if (accuracy >= 90) return '#d4edda' // 优秀
  if (accuracy >= 70) return '#fef9c3' // 良好
  if (accuracy >= 50) return '#fef3c7' // 一般
  return '#fde2e2'                     // 薄弱
}
