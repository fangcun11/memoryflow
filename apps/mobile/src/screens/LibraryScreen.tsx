// ============================================================
// 知识库页 — 文档列表 + 导入 + 一键生成卡片
// ============================================================

import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from '../store'
import { colors, spacing, radius } from '../theme'
import { SAMPLE_MATERIAL } from '../sampleData'

export default function LibraryScreen() {
  const insets = useSafeAreaInsets()
  const documents = useStore(s => s.documents)
  const blocks = useStore(s => s.blocks)
  const cards = useStore(s => s.cards)
  const importText = useStore(s => s.importText)
  const deleteDocument = useStore(s => s.deleteDocument)
  const generateFromBlocks = useStore(s => s.generateFromBlocks)

  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')

  function handleImport() {
    if (!title.trim() || !text.trim()) {
      Alert.alert('提示', '请填写标题和内容')
      return
    }
    const { document, blocks: newBlocks } = importText(title.trim(), text.trim())
    generateFromBlocks(newBlocks.map(b => b.id))
    setTitle('')
    setText('')
    setModalOpen(false)
    Alert.alert('导入成功', `「${document.title}」已导入并生成卡片`)
  }

  function loadSample() {
    const { document, blocks: newBlocks } = importText(SAMPLE_MATERIAL.title, SAMPLE_MATERIAL.text)
    generateFromBlocks(newBlocks.map(b => b.id))
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: '600', color: colors.ink }}>知识库</Text>
        <TouchableOpacity
          onPress={() => setModalOpen(true)}
          style={{
            backgroundColor: colors.coral,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>+ 导入材料</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        {documents.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.lg }}>
            <Text style={{ fontSize: 40 }}>📚</Text>
            <Text style={{ fontSize: 15, color: colors.inkSecondary, textAlign: 'center', lineHeight: 24 }}>
              还没有材料{'\n'}粘贴一段文本，自动分块并生成复习卡片
            </Text>
            <TouchableOpacity
              onPress={loadSample}
              style={{
                borderWidth: 1,
                borderColor: colors.coral,
                borderRadius: radius.md,
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.md,
              }}
            >
              <Text style={{ color: colors.coral, fontSize: 14, fontWeight: '600' }}>载入示例材料</Text>
            </TouchableOpacity>
          </View>
        )}

        {documents.map(doc => {
          const docBlocks = blocks.filter(b => b.documentId === doc.id)
          const docCards = cards.filter(c => docBlocks.some(b => b.id === c.blockId))
          return (
            <View
              key={doc.id}
              style={{
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink, flex: 1 }} numberOfLines={1}>
                  {doc.title}
                </Text>
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() =>
                    Alert.alert('删除文档', `确定删除「${doc.title}」及其所有卡片？`, [
                      { text: '取消', style: 'cancel' },
                      { text: '删除', style: 'destructive', onPress: () => deleteDocument(doc.id) },
                    ])
                  }
                >
                  <Text style={{ fontSize: 13, color: colors.red }}>删除</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 13, color: colors.inkTertiary, marginTop: spacing.sm }}>
                {docBlocks.length} 个知识块 · {docCards.length} 张卡片
              </Text>
              {/* 补充生成卡片 */}
              <TouchableOpacity
                onPress={() => generateFromBlocks(docBlocks.map(b => b.id))}
                style={{ marginTop: spacing.md }}
              >
                <Text style={{ fontSize: 13, color: colors.coral, fontWeight: '600' }}>
                  为全部知识块生成卡片 →
                </Text>
              </TouchableOpacity>
            </View>
          )
        })}
      </ScrollView>

      {/* 导入弹窗（Bottom Sheet 风格） */}
      {modalOpen && (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(44,44,42,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setModalOpen(false)} />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.xl,
              paddingBottom: insets.bottom + spacing.xl,
              gap: spacing.md,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.ink }}>导入学习材料</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="标题"
              placeholderTextColor={colors.inkTertiary}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                fontSize: 15,
                color: colors.ink,
                backgroundColor: colors.cream,
              }}
            />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="粘贴学习内容（支持空行分段、# 标题）"
              placeholderTextColor={colors.inkTertiary}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                fontSize: 15,
                color: colors.ink,
                backgroundColor: colors.cream,
                minHeight: 140,
              }}
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.inkSecondary, fontSize: 15 }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleImport}
                style={{
                  flex: 2,
                  backgroundColor: colors.coral,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>导入并生成卡片</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
