// ============================================================
// 统计页 — 今日概览 + 最近 14 天学习日历
// ============================================================

import React, { useMemo } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from '../store'
import { colors, spacing, radius } from '../theme'

function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets()
  const reviewLogs = useStore(s => s.reviewLogs)
  const cards = useStore(s => s.cards)

  const now = Date.now()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const todayLogs = reviewLogs.filter(l => l.reviewedAt >= todayStart.getTime())
  const todayCorrect = todayLogs.filter(l => l.rating >= 3).length

  // 连续学习天数
  const streak = useMemo(() => {
    const daySet = new Set(reviewLogs.map(l => dayKey(l.reviewedAt)))
    let s = 0
    const d = new Date()
    for (let i = 0; i < 365; i++) {
      const key = dayKey(d.getTime())
      if (daySet.has(key)) s++
      else if (i > 0) break
      d.setDate(d.getDate() - 1)
    }
    return s
  }, [reviewLogs])

  // 最近 14 天热力
  const heat = useMemo(() => {
    const daySet = new Map<string, number>()
    for (const log of reviewLogs) {
      const key = dayKey(log.reviewedAt)
      daySet.set(key, (daySet.get(key) || 0) + 1)
    }
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (13 - i))
      const count = daySet.get(dayKey(d.getTime())) || 0
      return { label: `${d.getMonth() + 1}/${d.getDate()}`, count }
    })
  }, [reviewLogs])

  const mastered = cards.filter(c => c.repetitions >= 3 && c.lapses === 0).length

  const stats = [
    { label: '今日复习', value: String(todayLogs.length), color: colors.coral, bg: colors.coralFaint },
    { label: '今日正确', value: String(todayCorrect), color: colors.green, bg: colors.greenLight },
    { label: '连续天数', value: String(streak), color: colors.amber, bg: colors.amberLight },
    { label: '已掌握', value: String(mastered), color: colors.blue, bg: colors.blueLight },
  ]

  const maxCount = Math.max(1, ...heat.map(h => h.count))

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, padding: spacing.lg, gap: spacing.xl }}
    >
      <Text style={{ fontSize: 24, fontWeight: '600', color: colors.ink }}>统计</Text>

      {/* 概览卡 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {stats.map(s => (
          <View
            key={s.label}
            style={{
              flexBasis: '47%',
              flexGrow: 1,
              backgroundColor: s.bg,
              borderRadius: radius.lg,
              padding: spacing.lg,
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 13, color: s.color, opacity: 0.85 }}>{s.label}</Text>
            <Text style={{ fontSize: 28, fontWeight: '600', color: s.color }}>{s.value}</Text>
          </View>
        ))}
      </View>

      {/* 最近 14 天 */}
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>最近 14 天</Text>
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 80 }}>
          {heat.map(h => (
            <View key={h.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  width: '100%',
                  height: Math.max(4, (h.count / maxCount) * 64),
                  borderRadius: 4,
                  backgroundColor: h.count > 0 ? colors.coral : colors.creamDark,
                }}
              />
              <Text style={{ fontSize: 9, color: colors.inkTertiary }} numberOfLines={1}>
                {h.label}
              </Text>
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 12, color: colors.inkTertiary }}>
          累计复习 {reviewLogs.length} 次 · 卡片总数 {cards.length}
        </Text>
      </View>
    </ScrollView>
  )
}
