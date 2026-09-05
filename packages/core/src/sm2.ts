// ============================================================
// SM-2 间隔重复算法（纯函数，零依赖）
// ============================================================

import type { Card, ReviewRating } from './types.ts'

/**
 * SM-2 算法：根据用户评分更新卡片调度参数
 * @param card 当前卡片
 * @param rating 用户评分 (0=忘记, 2=模糊, 4=记得, 5=简单)
 * @returns 更新后的卡片字段
 *
 * 四档语义（rating >= 2 算作通过）：
 * - 忘记(0)：重置进度，隔 1 天重来
 * - 模糊(2)：算通过但不涨间隔，小幅推进（Anki 的 Hard）
 * - 记得(4)：标准 SM-2 增长
 * - 简单(5)：在"记得"基础上乘 easy bonus 1.3
 */
export function sm2Update(
  card: Pick<Card, 'easeFactor' | 'interval' | 'repetitions' | 'lapses'>,
  rating: ReviewRating
): Pick<Card, 'easeFactor' | 'interval' | 'repetitions' | 'lapses' | 'dueDate'> {
  let { easeFactor: ef, interval, repetitions: n, lapses } = card
  let efDelta: number

  if (rating === 0) {
    // 答错
    n = 0
    interval = 1
    lapses = lapses + 1
    efDelta = 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)
  } else if (rating === 2) {
    // 模糊：通过，间隔只 +1 或 ×1.2（取大者）
    if (n === 0) {
      interval = 1
    } else {
      interval = Math.max(interval + 1, Math.round(interval * 1.2))
    }
    n = n + 1
    efDelta = -0.05
  } else {
    // 记得 / 简单
    if (n === 0) {
      interval = rating === 5 ? 4 : 1
    } else if (n === 1) {
      interval = rating === 5 ? 8 : 6
    } else {
      interval =
        rating === 5
          ? Math.round(interval * ef * 1.3)
          : Math.round(interval * ef)
    }
    n = n + 1
    efDelta = 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)
  }

  ef = ef + efDelta
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
