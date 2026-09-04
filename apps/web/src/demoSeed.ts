// ============================================================
// Web 端演示数据种子 — 仅在浏览器 localStorage 环境、首次启动时注入
// 产出「有生命感」的演示状态：
//   3 篇材料 → 知识块 → 卡片（新卡/复习中/难卡分布）
//   最近 14 天模拟复习记录（有起伏、近几天连续，撑起热力图和连续天数）
// ============================================================

import type { Card, ReviewLog, ReviewRating } from '@memoryflow/core'
import { sm2Update } from '@memoryflow/core'
import { useStore } from './stores/useStore'
import { MATERIALS, CARD_TYPES } from './demoMaterials'

const DEMO_KEY = 'demo-seeded-v1'

/** 14 天模拟复习日志：有起伏、近 5 天连续（撑起 streak），今天留几条 */
function buildFakeLogs(cards: Card[]): ReviewLog[] {
  const logs: ReviewLog[] = []
  const rand = (seed: number) => {
    // 稳定伪随机：同一天刷新结果一致
    const x = Math.sin(seed * 999) * 10000
    return x - Math.floor(x)
  }
  let id = 1
  for (let day = 13; day >= 0; day--) {
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    base.setDate(base.getDate() - day)
    // 每天复习量：5~14 张；偶尔休息一天（第 9 天）
    const count = day === 9 ? 0 : 5 + Math.floor(rand(day + 1) * 9)
    for (let i = 0; i < count && i < cards.length; i++) {
      const card = cards[(day * 3 + i) % cards.length]
      // 正确率 ~78%，越靠后越高（模拟进步）
      const pass = rand(day * 31 + i * 7 + 3) < 0.72 + (13 - day) * 0.006
      const rating: ReviewRating = pass
        ? rand(day * 13 + i) < 0.3 ? 5 : 4
        : rand(day * 17 + i) < 0.5 ? 2 : 0
      logs.push({
        id: id++,
        cardId: card.id,
        rating,
        reviewedAt: base.getTime() + (9 + Math.floor(rand(i + 7) * 12)) * 3600000 + i * 60000,
        timeSpent: 8000 + Math.floor(rand(i + 11) * 25000),
      })
    }
  }
  return logs
}

/** 把历史日志回放到卡片上，生成真实的 SM-2 状态分布 */
function applyLogsToCards(cards: Card[], logs: ReviewLog[]): Card[] {
  const byId = new Map(cards.map(c => [c.id, { ...c }]))
  const now = Date.now()
  // 按时间顺序回放每张卡的评分历史（最近 14 天内的）
  for (const log of logs.sort((a, b) => a.reviewedAt - b.reviewedAt)) {
    const card = byId.get(log.cardId)
    if (!card) continue
    const updates = sm2Update(card, log.rating)
    // reviewedAt 早于 now：dueDate 也要落在"当时"的尺度上
    const dueAt = log.reviewedAt + updates.interval * 86400000
    Object.assign(card, updates, { dueDate: dueAt })
  }
  // 回放完把明显过期的 dueDate 拉回：保证演示打开就有一小批到期卡可复习。
  // 卡池小（~30 张）且每天复习 5~14 张，最近 3 天几乎覆盖全池——
  // 所以到期卡的来源改为：把「最近 3 天没复习过」的卡优先拉回；
  // 若不够，再把「今天已复习但 dueDate 在 3 天内」的卡中挑几张拉回今天早上
  // （演示场景下轻微打破 SM-2 严格性是可接受的：打开就能复习，体验优先）。
  const result = [...byId.values()]
  const todayMorning = new Date()
  todayMorning.setHours(8, 0, 0, 0)
  const targetDue = todayMorning.getTime() - Math.floor(Math.random() * 3600000)

  const reviewedRecently = new Set(
    logs.filter(l => l.reviewedAt >= now - 3 * 86400000).map(l => l.cardId)
  )
  const untouched = result.filter(
    c => c.repetitions > 0 && !reviewedRecently.has(c.id)
  )
  const pulled = new Set<string>()
  for (const c of untouched.slice(0, 6)) {
    c.dueDate = targetDue
    pulled.add(c.id)
  }
  // 不足 6 张：从最近复习过的卡里随机补齐
  if (pulled.size < 6) {
    const recentCards = result.filter(c => c.repetitions > 0 && !pulled.has(c.id))
    // 稳定打散：按 id 哈希排序，避免每次刷新表现不同
    const shuffled = [...recentCards].sort(
      (a, b) => (a.id.charCodeAt(a.id.length - 1) % 17) - (b.id.charCodeAt(b.id.length - 1) % 17)
    )
    for (const c of shuffled.slice(0, 6 - pulled.size)) {
      c.dueDate = targetDue
      pulled.add(c.id)
    }
  }
  return result
}

/**
 * 首次启动注入演示数据。
 * 只在 localStorage 环境（web / 无 Electron bridge）且从未注入过时执行。
 * 用户手动清空数据后不会重新注入（标记在 localStorage 里）。
 */
export function seedDemoDataIfFirstRun(): void {
  try {
    // Electron 端不注入（桌面用户是真实使用者）
    if ((window as unknown as { memoryflowDesktop?: unknown }).memoryflowDesktop) return
    if (localStorage.getItem(DEMO_KEY)) return
    if (localStorage.getItem('political-learning-storage')) return // 老用户已有数据

    const store = useStore.getState()
    if (store.documents.length > 0 || store.cards.length > 0) {
      localStorage.setItem(DEMO_KEY, '1')
      return
    }

    // 1. 导入三篇材料（走真实解析管线，块质量与手动导入一致）
    const allBlockIds: string[] = []
    for (const m of MATERIALS) {
      const { blocks } = store.importText(m.title, m.text)
      allBlockIds.push(...blocks.map(b => b.id))
    }

    // 2. 出卡（标注 + 规则类型全覆盖）
    const state1 = useStore.getState()
    const newCards = state1.generateFromBlocks(allBlockIds, [...CARD_TYPES])

    // 3. 生成 14 天历史日志并回放到卡片 SM-2 状态
    const logs = buildFakeLogs(newCards)
    const evolvedCards = applyLogsToCards(newCards, logs)

    // 4. 一次性写入
    useStore.setState({
      cards: evolvedCards,
      reviewLogs: logs,
    })
    localStorage.setItem(DEMO_KEY, '1')
  } catch (e) {
    console.error('演示数据注入失败（不影响正常使用）:', e)
  }
}
