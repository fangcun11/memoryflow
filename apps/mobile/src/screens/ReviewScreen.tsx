// ============================================================
// 复习页 — 卡片翻转 + 手势评分 + 四档按钮
// ============================================================

import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Pressable,
  ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from '../store'
import { colors, spacing, radius } from '../theme'
import { predictInterval, formatInterval, type ReviewRating, type CardType } from '@memoryflow/core'

function typeLabel(t: CardType): string {
  switch (t) {
    case 'qa': return '问答'
    case 'cloze': return '填空'
    case 'essay': return '论述'
    case 'compare': return '对比'
    case 'recall': return '名解'
    case 'choice': return '选择'
    case 'judge': return '判断'
  }
}

const SCREEN_W = Dimensions.get('window').width
const SWIPE_THRESHOLD = 90

const RATINGS: { rating: ReviewRating; label: string; color: string; bg: string }[] = [
  { rating: 0, label: '忘记', color: colors.red, bg: colors.redLight },
  { rating: 2, label: '模糊', color: colors.amber, bg: colors.amberLight },
  { rating: 4, label: '记得', color: colors.green, bg: colors.greenLight },
  { rating: 5, label: '简单', color: colors.blue, bg: colors.blueLight },
]

export default function ReviewScreen({
  onFirstRun,
}: {
  onFirstRun?: () => void
}) {
  const insets = useSafeAreaInsets()
  const [flipped, setFlipped] = useState(false)
  const [dragX, setDragX] = useState(0)

  const reviewQueue = useStore(s => s.reviewQueue)
  const currentReviewIndex = useStore(s => s.currentReviewIndex)
  const startReview = useStore(s => s.startReview)
  const rateCard = useStore(s => s.rateCard)
  const nextCard = useStore(s => s.nextCard)
  const endReview = useStore(s => s.endReview)
  const cards = useStore(s => s.cards)

  const card = reviewQueue[currentReviewIndex]
  const reviewing = reviewQueue.length > 0

  const now = Date.now()
  const dueCount = cards.filter(c => c.dueDate <= now && c.repetitions > 0).length
  const newCount = cards.filter(c => c.repetitions === 0).length

  // 当前卡四档评分的预测间隔
  const intervals = useMemo(() => {
    if (!card) return null
    return RATINGS.map(r => formatInterval(predictInterval(card, r.rating)))
  }, [card])

  function handleRate(rating: ReviewRating) {
    if (!card) return
    rateCard(rating)
    setFlipped(false)
    setDragX(0)
    nextCard()
  }

  // === 空态 ===
  if (!reviewing) {
    return (
      <ScrollView
        contentContainerStyle={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
          paddingTop: insets.top + spacing.xl,
        }}
      >
        <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>🧠</Text>
        <Text style={{ fontSize: 24, fontWeight: '600', color: colors.ink, marginBottom: spacing.sm }}>
          {cards.length === 0 ? '欢迎使用 MemoryFlow' : '今日复习完成'}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: colors.inkSecondary,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: spacing.xl,
          }}
        >
          {cards.length === 0
            ? '先载入一份示例材料，体验艾宾浩斯间隔复习'
            : `到期卡片 ${dueCount} 张，新卡 ${newCount} 张已清空\n稍后再来看看吧`}
        </Text>
        {cards.length === 0 ? (
          <TouchableOpacity
            onPress={() => onFirstRun?.()}
            style={{
              backgroundColor: colors.coral,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>载入示例材料</Text>
          </TouchableOpacity>
        ) : (
          (dueCount > 0 || newCount > 0) && (
            <TouchableOpacity
              onPress={() => {
                startReview()
                setFlipped(false)
              }}
              style={{
                backgroundColor: colors.coral,
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                开始复习（{dueCount + newCount}）
              </Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>
    )
  }

  // === 复习中 ===
  const progress = (currentReviewIndex + 1) / reviewQueue.length
  const rotate = flipped ? '180deg' : '0deg'

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      {/* 顶栏：进度 + 退出 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
      >
        <TouchableOpacity onPress={endReview} hitSlop={12}>
          <Text style={{ fontSize: 20, color: colors.inkTertiary }}>✕</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.creamDark, overflow: 'hidden' }}>
          <View
            style={{
              width: `${Math.round(progress * 100)}%`,
              height: '100%',
              borderRadius: 3,
              backgroundColor: colors.coral,
            }}
          />
        </View>
        <Text style={{ fontSize: 12, color: colors.inkTertiary, minWidth: 40, textAlign: 'right' }}>
          {currentReviewIndex + 1}/{reviewQueue.length}
        </Text>
      </View>

      {/* 卡片区：手势评分（未翻面时） */}
      <Pressable
        style={{ flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' }}
        onPress={() => setFlipped(f => !f)}
      >
        <View
          style={{
            transform: [{ translateX: dragX }, { rotate }],
            backgroundColor: colors.card,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.xl,
            minHeight: 320,
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: flipped ? colors.inkTertiary : colors.coral,
              fontWeight: '600',
              marginBottom: spacing.md,
              letterSpacing: 1,
            }}
          >
            {flipped ? '答案' : '问题 · 点击翻面'}
          </Text>
          <Text style={{ fontSize: 19, lineHeight: 32, color: colors.ink }}>
            {flipped ? card.back : card.front}
          </Text>
          {flipped && (
            <Text style={{ fontSize: 12, color: colors.inkTertiary, marginTop: spacing.lg }}>
              卡片类型：{typeLabel(card.type)}
            </Text>
          )}
        </View>
        {!flipped && (
          <Text style={{ textAlign: 'center', fontSize: 12, color: colors.inkTertiary, marginTop: spacing.lg }}>
            左滑 = 忘记 · 右滑 = 简单
          </Text>
        )}
      </Pressable>

      {/* 评分区（翻面后显示） */}
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          opacity: flipped ? 1 : 0.35,
        }}
        pointerEvents={flipped ? 'auto' : 'none'}
      >
        {RATINGS.map((r, i) => (
          <TouchableOpacity
            key={r.rating}
            onPress={() => handleRate(r.rating)}
            style={{
              flex: 1,
              backgroundColor: r.bg,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Text style={{ color: r.color, fontSize: 14, fontWeight: '600' }}>{r.label}</Text>
            <Text style={{ color: r.color, fontSize: 11, opacity: 0.75 }}>
              {intervals?.[i]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}
