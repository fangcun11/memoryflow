// ============================================================
// SM-2 间隔重复算法（纯函数，零依赖）
// ============================================================

import type { Card, ReviewRating } from './types.ts'

/**
 * SM-2 算法：根据用户评分更新卡片调度参数
 * @param card 当前卡片
 * @param rating 用户评分 (0=忘记, 2=模糊, 4=记得, 5=简单)
 * @returns 更新后的卡片字段
 */
export function sm2Update(
  card: Pick<Card, 'easeFactor' | 'interval' | 'repetitions' | 'lapses'>,
  rating: ReviewRating
): Pick<Card, 'easeFactor' | 'interval' | 'repetitions' | 'lapses' | 'dueDate'> {
  let { easeFactor: ef, interval, repetitions: n, lapses } = card

  if (rating >= 3) {
    // 答对
    if (n === 0) {
      interval = 1
    } else if (n === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * ef)
    }
    n = n + 1
  } else {
    // 答错
    n = 0
    interval = 1
    lapses = lapses + 1
  }

  // 更新容易度因子
  ef = ef + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  if (ef < 1.3) ef = 1.3

  const dueDate = Date.now() + interval * 86400000

  return {
    easeFactor: Math.round(ef * 100) / 100,
    interval,
    repetitions: n,
    lapses,
    dueDate,
  }
}

/**
 * 预测评分后的下次间隔（用于按钮显示）
 */
export function predictInterval(
  card: Pick<Card, 'easeFactor' | 'interval' | 'repetitions'>,
  rating: ReviewRating
): number {
  const result = sm2Update({ ...card, lapses: 0 }, rating)
  return result.interval
}

/**
 * 格式化间隔为可读字符串
 */
export function formatInterval(days: number): string {
  if (days < 1) return '<1天'
  if (days === 1) return '1天'
  if (days < 30) return `${days}天`
  if (days < 365) return `${Math.round(days / 30)}个月`
  return `${(days / 365).toFixed(1)}年`
}
