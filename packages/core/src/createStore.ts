// ============================================================
// Store 工厂：创建跨端共享的 Zustand store
// 各端注入自己的存储适配器（web=localStorage, rn=AsyncStorage, mp=wx.storage）
// ============================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  Document,
  KnowledgeBlock,
  Tag,
  Card,
  CardType,
  ReviewLog,
  ReviewRating,
  LearningSettings,
  AppState,
  StorageAdapter,
} from './types'
import { createId } from './id'
import { sm2Update } from './sm2'
import { generateCards } from './cardGenerator'
import { parseTextToBlocks, PRESET_TAGS } from './textParser'

export interface StoreActions {
  // === 文档 ===
  importText: (title: string, text: string) => { document: Document; blocks: KnowledgeBlock[] }
  deleteDocument: (docId: string) => void

  // === 知识块 ===
  updateBlockTags: (blockId: string, tags: string[]) => void
  updateBlockDifficulty: (blockId: string, difficulty: number) => void
  setBlockRelated: (blockId: string, relatedIds: string[]) => void
  deleteBlock: (blockId: string) => void
  addBlock: (documentId: string, content: string, title?: string) => KnowledgeBlock

  // === 标签 ===
  addTag: (name: string, parentId?: string) => Tag
  deleteTag: (tagId: string) => void

  // === 卡片生成 ===
  generateFromBlocks: (blockIds: string[], types?: CardType[]) => Card[]
  generateFromTag: (tagName: string, types?: CardType[]) => Card[]
  deleteCard: (cardId: string) => void

  // === 复习 ===
  startReview: () => void
  flipCard: () => void
  rateCard: (rating: ReviewRating) => void
  nextCard: () => void
  endReview: () => void
  getDueCards: () => Card[]
  getNewCards: () => Card[]
  getHardCards: () => Card[]
  getReviewStats: () => {
    total: number
    reviewed: number
    correct: number
    streak: number
  }

  // === 设置 ===
  updateSettings: (settings: Partial<LearningSettings>) => void

  // === 数据导入导出 ===
  exportData: () => string
  importData: (json: string) => void
  clearAll: () => void
}

export type MemoryFlowStore = AppState & StoreActions

export const DEFAULT_SETTINGS: LearningSettings = {
  newCardsPerDay: 20,
  reviewLimit: 100,
  hardThreshold: 3,
  easeThreshold: 2.0,
}

/**
 * 创建 store 实例
 * @param storage 存储适配器；不传则仅在内存中运行（适合测试）
 * @param storageKey 持久化 key，各端可自定义
 */
export function createMemoryFlowStore(
  storage?: StorageAdapter,
  storageKey = 'political-learning-storage'
) {
  return create<MemoryFlowStore>()(
    persist(
      (set, get) => ({
        // 初始状态
        documents: [],
        blocks: [],
        tags: PRESET_TAGS.map(name => ({ id: createId(), name })),
        cards: [],
        reviewLogs: [],
        settings: DEFAULT_SETTINGS,
        reviewQueue: [],
        currentReviewIndex: 0,
        reviewSession: { started: 0, reviewed: 0, correct: 0 },

        // === 文档 ===
        importText: (title, text) => {
          const result = parseTextToBlocks(text, title)
          set(state => ({
            documents: [...state.documents, result.document],
            blocks: [...state.blocks, ...result.blocks],
          }))
          return result
        },

        deleteDocument: docId => {
          set(state => {
            const blockIds = state.blocks
              .filter(b => b.documentId === docId)
              .map(b => b.id)
            return {
              documents: state.documents.filter(d => d.id !== docId),
              blocks: state.blocks.filter(b => b.documentId !== docId),
              cards: state.cards.filter(c => !blockIds.includes(c.blockId)),
            }
          })
        },

        // === 知识块 ===
        updateBlockTags: (blockId, tags) => {
          set(state => ({
            blocks: state.blocks.map(b =>
              b.id === blockId ? { ...b, tags, updatedAt: Date.now() } : b
            ),
          }))
        },

        updateBlockDifficulty: (blockId, difficulty) => {
          set(state => ({
            blocks: state.blocks.map(b =>
              b.id === blockId ? { ...b, difficulty, updatedAt: Date.now() } : b
            ),
          }))
        },

        setBlockRelated: (blockId, relatedIds) => {
          set(state => ({
            blocks: state.blocks.map(b =>
              b.id === blockId ? { ...b, relatedIds, updatedAt: Date.now() } : b
            ),
          }))
        },

        deleteBlock: blockId => {
          set(state => ({
            blocks: state.blocks.filter(b => b.id !== blockId),
            cards: state.cards.filter(c => c.blockId !== blockId),
          }))
        },

        addBlock: (documentId, content, title) => {
          const block: KnowledgeBlock = {
            id: createId(),
            documentId,
            content,
            title,
            tags: [],
            difficulty: 3,
            relatedIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          set(state => ({
            blocks: [...state.blocks, block],
          }))
          return block
        },

        // === 标签 ===
        addTag: (name, parentId) => {
          const tag: Tag = { id: createId(), name, parentId }
          set(state => ({
            tags: [...state.tags, tag],
          }))
          return tag
        },

        deleteTag: tagId => {
          set(state => {
            const removed = state.tags.find(t => t.id === tagId)
            if (!removed) return state
            return {
              tags: state.tags.filter(t => t.id !== tagId),
              blocks: state.blocks.map(b => ({
                ...b,
                tags: b.tags.filter(name => name !== removed.name),
              })),
            }
          })
        },

        // === 卡片生成 ===
        generateFromBlocks: (blockIds, types = ['qa', 'cloze', 'essay']) => {
          const state = get()
          const targetBlocks = state.blocks.filter(b => blockIds.includes(b.id))
          const newCards = generateCards(targetBlocks, types)
          set(s => ({
            cards: [...s.cards, ...newCards],
          }))
          return newCards
        },

        generateFromTag: (tagName, types = ['qa', 'cloze', 'essay']) => {
          const state = get()
          const targetBlocks = state.blocks.filter(b => b.tags.includes(tagName))
          const newCards = generateCards(targetBlocks, types)
          set(s => ({
            cards: [...s.cards, ...newCards],
          }))
          return newCards
        },

        deleteCard: cardId => {
          set(state => ({
            cards: state.cards.filter(c => c.id !== cardId),
          }))
        },

        // === 复习 ===
        startReview: () => {
          const state = get()
          const now = Date.now()
          const dueCards = state.cards
            .filter(c => c.dueDate <= now && c.repetitions > 0)
            .sort((a, b) => a.dueDate - b.dueDate)
          const newCards = state.cards
            .filter(c => c.repetitions === 0)
            .slice(0, state.settings.newCardsPerDay)

          const queue = [...dueCards.slice(0, state.settings.reviewLimit), ...newCards]
          set({
            reviewQueue: queue,
            currentReviewIndex: 0,
            reviewSession: { started: now, reviewed: 0, correct: 0 },
          })
        },

        flipCard: () => {
          // 翻转由组件状态控制
        },

        rateCard: rating => {
          const state = get()
          const card = state.reviewQueue[state.currentReviewIndex]
          if (!card) return

          const updates = sm2Update(card, rating)

          set(s => ({
            cards: s.cards.map(c =>
              c.id === card.id ? { ...c, ...updates } : c
            ),
            reviewLogs: [
              ...s.reviewLogs,
              {
                id: Date.now(),
                cardId: card.id,
                rating,
                reviewedAt: Date.now(),
                timeSpent: Date.now() - s.reviewSession.started,
              },
            ],
            reviewSession: {
              ...s.reviewSession,
              reviewed: s.reviewSession.reviewed + 1,
              correct: s.reviewSession.correct + (rating >= 3 ? 1 : 0),
            },
          }))
        },

        nextCard: () => {
          set(state => ({
            currentReviewIndex: state.currentReviewIndex + 1,
          }))
        },

        endReview: () => {
          set({
            reviewQueue: [],
            currentReviewIndex: 0,
          })
        },

        getDueCards: () => {
          const state = get()
          const now = Date.now()
          return state.cards.filter(c => c.dueDate <= now && c.repetitions > 0)
        },

        getNewCards: () => {
          const state = get()
          return state.cards.filter(c => c.repetitions === 0)
        },

        getHardCards: () => {
          const state = get()
          return state.cards.filter(
            c =>
              c.lapses >= state.settings.hardThreshold ||
              c.easeFactor < state.settings.easeThreshold
          )
        },

        getReviewStats: () => {
          const state = get()
          const todayStart = new Date()
          todayStart.setHours(0, 0, 0, 0)
          const todayLogs = state.reviewLogs.filter(
            l => l.reviewedAt >= todayStart.getTime()
          )

          // 计算连续学习天数
          const streak = calculateStreak(state.reviewLogs)

          return {
            total: state.cards.length,
            reviewed: todayLogs.length,
            correct: todayLogs.filter(l => l.rating >= 3).length,
            streak,
          }
        },

        // === 设置 ===
        updateSettings: newSettings => {
          set(state => ({
            settings: { ...state.settings, ...newSettings },
          }))
        },

        // === 数据管理 ===
        exportData: () => {
          const state = get()
          return JSON.stringify(
            {
              documents: state.documents,
              blocks: state.blocks,
              tags: state.tags,
              cards: state.cards,
              reviewLogs: state.reviewLogs,
              settings: state.settings,
            },
            null,
            2
          )
        },

        importData: json => {
          try {
            const data = JSON.parse(json)
            set({
              documents: data.documents || [],
              blocks: data.blocks || [],
              tags: data.tags || PRESET_TAGS.map(name => ({ id: createId(), name })),
              cards: data.cards || [],
              reviewLogs: data.reviewLogs || [],
              settings: data.settings || DEFAULT_SETTINGS,
            })
          } catch (e) {
            console.error('导入数据失败:', e)
          }
        },

        clearAll: () => {
          set({
            documents: [],
            blocks: [],
            tags: PRESET_TAGS.map(name => ({ id: createId(), name })),
            cards: [],
            reviewLogs: [],
            settings: DEFAULT_SETTINGS,
            reviewQueue: [],
            currentReviewIndex: 0,
          })
        },
      }),
      {
        name: storageKey,
        // 只持久化业务数据；复习会话是运行时状态，刷新即作废，
        // 否则会恢复过期队列 + 旧 EF 快照（队列评分与主数据不一致）
        partialize: state => ({
          documents: state.documents,
          blocks: state.blocks,
          tags: state.tags,
          cards: state.cards,
          reviewLogs: state.reviewLogs,
          settings: state.settings,
        }),
        ...(storage ? { storage: createJSONStorage(() => storage) } : {}),
      }
    )
  )
}

function calculateStreak(logs: ReviewLog[]): number {
  if (logs.length === 0) return 0

  const daySet = new Set<string>()
  for (const log of logs) {
    const d = new Date(log.reviewedAt)
    daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  }

  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (daySet.has(key)) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  return streak
}
