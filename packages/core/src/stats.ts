// ============================================================
// 学习看板统计（纯函数，零 DOM 依赖）
// web / mobile 共享同一份派生计算，避免两端指标口径漂移
// ============================================================

import type { Card, KnowledgeBlock, LearningSettings, ReviewLog, Tag } from './types.ts'

/** 卡片记忆分层（比"待复习/新卡/学习中"更有记忆科学含义） */
export type CardTier = 'new' | 'learning' | 'familiar' | 'mastered' | 'hard'

export const TIER_LABELS: Record<CardTier, string> = {
  new: '新卡',
  learning: '学习中',
  familiar: '熟悉',
  mastered: '已掌握',
  hard: '难卡',
}

export const TIER_ORDER: CardTier[] = ['new', 'learning', 'familiar', 'mastered', 'hard']

/**
 * 单卡分层。难卡优先（从其他档中剥离），其次按间隔与重复次数：
 * - 难卡：多次忘记或容易度低
 * - 已掌握：间隔 ≥ 21 天
 * - 熟悉：通过 ≥ 3 次且无忘记记录
 * - 学习中：通过 1-2 次
 */
export function cardTier(
  card: Pick<Card, 'repetitions' | 'lapses' | 'easeFactor' | 'interval'>,
  settings: Pick<LearningSettings, 'hardThreshold' | 'easeThreshold'>
): CardTier {
  if (card.lapses >= settings.hardThreshold || card.easeFactor < settings.easeThreshold) {
    return 'hard'
  }
  if (card.interval >= 21) return 'mastered'
  if (card.repetitions >= 3) return 'familiar'
  if (card.repetitions > 0) return 'learning'
  return 'new'
}

export interface DashboardStats {
  today: {
    reviewed: number
    correct: number // rating >= 2（模糊也算通过）
    streak: number
  }
  tiers: Record<CardTier, number>
  /** 未来 14 天每日到期量（第 1 天含已逾期） */
  forecast: { date: string; label: string; count: number }[]
  /** 标签薄弱度：未复习的排最前，其余按正确率升序 */
  tagWeakness: {
    name: string
    cardCount: number
    reviewCount: number
    accuracy: number // -1 = 未复习
  }[]
  /** 最近 days 天每日复习次数（升序，最后一天为今天） */
  heatmap: { date: string; count: number }[]
  totals: {
    cards: number
    blocks: number
    reviews: number
    masteredRate: number // 已掌握占比 %
  }
}

function dayStart(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function calculateStreakFromLogs(logs: Pick<ReviewLog, 'reviewedAt'>[]): number {
  if (logs.length === 0) return 0
  const daySet = new Set(logs.map(l => dayStart(l.reviewedAt)))
  let streak = 0
  const today = dayStart(Date.now())
  for (let i = 0; i < 365; i++) {
    const key = today - i * 86400000
    if (daySet.has(key)) streak++
    else if (i > 0) break
  }
  return streak
}

/**
 * 看板统计主入口
 */
export function getDashboardStats(state: {
  cards: Card[]
  blocks: KnowledgeBlock[]
  tags: Tag[]
  reviewLogs: ReviewLog[]
  settings: LearningSettings
}): DashboardStats {
  const { cards, blocks, tags, reviewLogs, settings } = state
  const now = Date.now()
  const today0 = dayStart(now)

  // === 今日 ===
  const todayLogs = reviewLogs.filter(l => l.reviewedAt >= today0)
  const today = {
    reviewed: todayLogs.length,
    correct: todayLogs.filter(l => l.rating >= 2).length,
    streak: calculateStreakFromLogs(reviewLogs),
  }

  // === 记忆分层 ===
  const tiers: Record<CardTier, number> = { new: 0, learning: 0, familiar: 0, mastered: 0, hard: 0 }
  for (const c of cards) tiers[cardTier(c, settings)]++

  // === 未来 14 天到期预测 ===
  const forecast: DashboardStats['forecast'] = []
  for (let i = 0; i < 14; i++) {
    const start = today0 + i * 86400000
    const end = start + 86400000
    // 第 1 天把历史逾期一起算进来（dueDate < 今天的到期卡都该今天处理）
    const count = cards.filter(c => {
      if (c.repetitions === 0) return false
      if (i === 0) return c.dueDate < end
      return c.dueDate >= start && c.dueDate < end
    }).length
    const d = new Date(start)
    forecast.push({
      date: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
      label: i === 0 ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`,
      count,
    })
  }

  // === 标签薄弱度 ===
  const tagWeakness = tags
    .map(tag => {
      const tagBlockIds = new Set(blocks.filter(b => b.tags.includes(tag.name)).map(b => b.id))
      const tagCards = cards.filter(c => tagBlockIds.has(c.blockId))
      const cardIds = new Set(tagCards.map(c => c.id))
      const tagLogs = reviewLogs.filter(l => cardIds.has(l.cardId))
      const total = tagLogs.length
      const correct = tagLogs.filter(l => l.rating >= 2).length
      return {
        name: tag.name,
        cardCount: tagCards.length,
        reviewCount: total,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : -1,
      }
    })
    .filter(t => t.cardCount > 0)
    .sort((a, b) => {
      // 未复习(-1) 最薄弱排最前，其余正确率升序
      if (a.accuracy < 0 && b.accuracy < 0) return b.cardCount - a.cardCount
      if (a.accuracy < 0) return -1
      if (b.accuracy < 0) return 1
      return a.accuracy - b.accuracy
    })

  // === 热力图（默认最近 15 周，按天聚合） ===
  const HEATMAP_DAYS = 15 * 7
  const countByDay = new Map<number, number>()
  for (const l of reviewLogs) countByDay.set(dayStart(l.reviewedAt), (countByDay.get(dayStart(l.reviewedAt)) || 0) + 1)
  const heatmap: DashboardStats['heatmap'] = []
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const start = today0 - i * 86400000
    const d = new Date(start)
    heatmap.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      count: countByDay.get(start) || 0,
    })
  }

  const masteredCount = tiers.mastered
  return {
    today,
    tiers,
    forecast,
    tagWeakness,
    heatmap,
    totals: {
      cards: cards.length,
      blocks: blocks.length,
      reviews: reviewLogs.length,
      masteredRate: cards.length > 0 ? Math.round((masteredCount / cards.length) * 100) : 0,
    },
  }
}
