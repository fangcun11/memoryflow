// ============================================================
// MemoryFlow Mobile — App 入口（Tab 导航：复习 / 知识库 / 统计）
// ============================================================

import React, { useCallback } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from './src/store'
import { colors, spacing } from './src/theme'
import { SAMPLE_MATERIAL } from './src/sampleData'
import ReviewScreen from './src/screens/ReviewScreen'
import LibraryScreen from './src/screens/LibraryScreen'
import StatsScreen from './src/screens/StatsScreen'

type Tab = 'review' | 'library' | 'stats'

function TabButton({
  label,
  active,
  badge,
  onPress,
}: {
  label: string
  active: boolean
  badge?: number
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.sm }}
      activeOpacity={0.7}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: active ? '600' : '400',
          color: active ? colors.coral : colors.inkTertiary,
        }}
      >
        {label}
      </Text>
      {badge != null && badge > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 2,
            backgroundColor: colors.coral,
            borderRadius: 8,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 4,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 11, color: '#fff' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

function AppInner() {
  const insets = useSafeAreaInsets()
  const [tab, setTab] = React.useState<Tab>('review')

  const cards = useStore(s => s.cards)
  const documents = useStore(s => s.documents)
  const importText = useStore(s => s.importText)
  const generateFromBlocks = useStore(s => s.generateFromBlocks)

  const now = Date.now()
  const dueCount = cards.filter(c => c.dueDate <= now && c.repetitions > 0).length
  const newCount = cards.filter(c => c.repetitions === 0).length

  const isEmpty = documents.length === 0 && cards.length === 0

  const loadSample = useCallback(() => {
    const { document, blocks } = importText(SAMPLE_MATERIAL.title, SAMPLE_MATERIAL.text)
    generateFromBlocks(blocks.map(b => b.id))
  }, [importText, generateFromBlocks])

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        {tab === 'review' && <ReviewScreen onFirstRun={isEmpty ? loadSample : undefined} />}
        {tab === 'library' && <LibraryScreen />}
        {tab === 'stats' && <StatsScreen />}
      </View>
      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          paddingBottom: insets.bottom,
        }}
      >
        <TabButton
          label="复习"
          active={tab === 'review'}
          badge={dueCount + newCount}
          onPress={() => setTab('review')}
        />
        <TabButton label="知识库" active={tab === 'library'} onPress={() => setTab('library')} />
        <TabButton label="统计" active={tab === 'stats'} onPress={() => setTab('stats')} />
      </View>
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  )
}
