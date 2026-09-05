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
  ReviewSnapshot,
  CardPreview,
  LearningSettings,
  AppState,
  StorageAdapter,
} from './types.ts'
import { createId } from './id.ts'
import { sm2Update } from './sm2.ts'
import { generateCards } from './cardGenerator.ts'
import { parseTextToBlocks, PRESET_TAGS } from './textParser.ts'

/**
 * 按稳定身份合并新生成的卡片：
 * - 同 identity 的已有卡 → 更新卡面内容（front/back/选项），保留 id 与 SM-2 调度状态
 * - 遗留卡（无 identity）按 blockId+type+front 兜底认领：front 相同即视为同一张卡，
 *   补写 identity 并保留调度状态（旧版本生成的存量卡不产生重复）
 * - 其余 → 追加为新卡
 * 重复点击"生成"不再产生重复卡；块内容编辑后重出卡，复习历史不丢。
 */
function mergeGeneratedCards(
  existing: Card[],
  fresh: Card[]
): { cards: Card[]; added: number; updated: number } {
  const result = [...existing]
  const indexByIdentity = new Map<string, number>()
  const legacyIndex = new Map<string, number>() // 无 identity 的旧卡：blockId#type#front
  result.forEach((c, i) => {
    if (c.identity) indexByIdentity.set(c.identity, i)
    else legacyIndex.set(`${c.blockId}#${c.type}#${c.front}`, i)
  })

  let added = 0
  let updated = 0
  for (const card of fresh) {
    let idx = card.identity ? indexByIdentity.get(card.identity) : undefined
    let adoptIdentity = false
    if (idx === undefined && card.identity) {
      const legacyIdx = legacyIndex.get(`${card.blockId}#${card.type}#${card.front}`)
      if (legacyIdx !== undefined) {
        idx = legacyIdx
        adoptIdentity = true // 认领旧卡，补写身份
      }
    }
    if (idx !== undefined) {
      result[idx] = {
        ...result[idx],
        front: card.front,
        back: card.back,
        options: card.options,
        answerIndex: card.answerIndex,
        judgeAnswer: card.judgeAnswer,
        ...(adoptIdentity ? { identity: card.identity } : {}),
      }
      updated++
    } else {
      result.push(card)
      if (card.identity) indexByIdentity.set(card.identity, result.length - 1)
      added++
    }
  }
  return { cards: result, added, updated }
}

export interface StoreActions {
  // === 文档 ===
  importText: (title: string, text: string) => { document: Document; blocks: KnowledgeBlock[] }
  deleteDocument: (docId: string) => void

  // === 知识块 ===
  updateBlockTags: (blockId: string, tags: string[]) => void
  updateBlockDifficulty: (blockId: string, difficulty: number) => void
  updateBlockContent: (blockId: string, content: string, title?: string) => void
  setBlockRelated: (blockId: string, relatedIds: string[]) => void
  deleteBlock: (blockId: string) => void
  addBlock: (documentId: string, content: string, title?: string) => KnowledgeBlock

  // === 标签 ===
  addTag: (name: string, parentId?: string) => Tag
  deleteTag: (tagId: string) => void

  // === 卡片生成 ===
  generateFromBlocks: (blockIds: string[], types?: CardType[]) => Card[]
  generateFromTag: (tagName: string, types?: CardType[]) => Card[]
  generateFromPreviews: (previews: CardPreview[]) => { added: number; updated: number }
  deleteCard: (cardId: string) => void

  // === 复习 ===
  startReview: (tagFilter?: string) => void
  flipCard: () => void
  rateCard: (rating: ReviewRating) => void
  undoLastReview: () => void
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
        lastReviewSnapshot: null,
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

        // 更新知识块内容；已从该块生成的卡片不会自动重写（卡片是导入时的快照），
        // 由调用方决定是否重新出卡
        updateBlockContent: (blockId, content, title) => {
          set(state => ({
            blocks: state.blocks.map(b =>
              b.id === blockId
                ? {
                    ...b,
                    content: content.trim(),
                    // 未显式传 title 时保持原标题
                    title: title !== undefined ? title.trim() || undefined : b.title,
                    updatedAt: Date.now(),
                  }
                : b
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
          const fresh = generateCards(targetBlocks, types)
          const { cards } = mergeGeneratedCards(state.cards, fresh)
          set({ cards })
          return fresh
        },

        generateFromTag: (tagName, types = ['qa', 'cloze', 'essay']) => {
          const state = get()
          const targetBlocks = state.blocks.filter(b => b.tags.includes(tagName))
          const fresh = generateCards(targetBlocks, types)
          const { cards } = mergeGeneratedCards(state.cards, fresh)
          set({ cards })
          return fresh
        },

        generateFromPreviews: previews => {
          const state = get()
          const fresh = previews.map(p => p.card)
          const { cards, added, updated } = mergeGeneratedCards(state.cards, fresh)
          set({ cards })
          return { added, updated }
        },

        deleteCard: cardId => {
          set(state => ({
            cards: state.cards.filter(c => c.id !== cardId),
            // 清掉该卡的复习日志，避免看板统计残留孤儿数据
            reviewLogs: state.reviewLogs.filter(l => l.cardId !== cardId),
            // 若该卡还在当前复习队列中，同步剔除
            reviewQueue:
              state.currentReviewIndex < state.reviewQueue.length
                ? state.reviewQueue.filter(c => c.id !== cardId)
                : state.reviewQueue,
          }))
        },

        // === 复习 ===
        startReview: (tagFilter?: string) => {
          const state = get()
          const now = Date.now()
          // 按标签发起复习时，只取该标签下知识块的卡片
          const tagBlockIds = tagFilter
            ? new Set(state.blocks.filter(b => b.tags.includes(tagFilter)).map(b => b.id))
            : null
          const inScope = (c: Card) => !tagBlockIds || tagBlockIds.has(c.blockId)
          const dueCards = state.cards
            .filter(c => c.dueDate <= now && c.repetitions > 0 && inScope(c))
            .sort((a, b) => a.dueDate - b.dueDate)
          const newCards = state.cards
            .filter(c => c.repetitions === 0 && inScope(c))
            .slice(0, state.settings.newCardsPerDay)

          const queue = [...dueCards.slice(0, state.settings.reviewLimit), ...newCards]
          set({
            reviewQueue: queue,
            currentReviewIndex: 0,
            lastReviewSnapshot: null,
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
          const updatedCard: Card = { ...card, ...updates }
          const logId = Date.now()
          const snapshot: ReviewSnapshot = {
            card: { ...card },
            index: state.currentReviewIndex,
            logId,
            reviewed: state.reviewSession.reviewed,
            correct: state.reviewSession.correct,
            requeued: rating === 0,
          }

          set(s => ({
            cards: s.cards.map(c =>
              c.id === card.id ? updatedCard : c
            ),
            // 忘记的卡当次会话末尾再排一次（重学）；队列内已有的同卡同步为新
            // SM-2 状态，保证重学时基于最新参数评分。
            reviewQueue:
              rating === 0
                ? [
                    ...s.reviewQueue.map(c => (c.id === card.id ? updatedCard : c)),
                    updatedCard,
                  ]
                : s.reviewQueue.map(c => (c.id === card.id ? updatedCard : c)),
            reviewLogs: [
              ...s.reviewLogs,
              {
                id: logId,
                cardId: card.id,
                rating,
                reviewedAt: Date.now(),
                timeSpent: Date.now() - s.reviewSession.started,
              },
            ],
            lastReviewSnapshot: snapshot,
            reviewSession: {
              ...s.reviewSession,
              reviewed: s.reviewSession.reviewed + 1,
              correct: s.reviewSession.correct + (rating >= 2 ? 1 : 0),
            },
          }))
        },

        // 撤销最近一次评分：恢复卡片 SM-2 状态、删日志、回退会话计数，
        // 并把队列指针拨回该卡（若触发过重排，同时移除追加的副本）
        undoLastReview: () => {
          const snap = get().lastReviewSnapshot
          if (!snap) return
          set(s => {
            let queue = s.reviewQueue
            if (snap.requeued) {
              const ids = queue.map(c => c.id)
              const lastIdx = ids.lastIndexOf(snap.card.id)
              if (lastIdx >= 0) queue = queue.filter((_, i) => i !== lastIdx)
            }
            return {
              cards: s.cards.map(c => (c.id === snap.card.id ? snap.card : c)),
              // 队列内剩余的同卡副本也要还原为评分前状态，
              // 否则撤销后展示/再次评分会用到被重置的 SM-2 参数
              reviewQueue: queue.map(c => (c.id === snap.card.id ? snap.card : c)),
              currentReviewIndex: snap.index,
              lastReviewSnapshot: null,
              reviewLogs: s.reviewLogs.filter(l => l.id !== snap.logId),
              reviewSession: {
                ...s.reviewSession,
                reviewed: snap.reviewed,
                correct: snap.correct,
              },
            }
          })
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
            lastReviewSnapshot: null,
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
            correct: todayLogs.filter(l => l.rating >= 2).length,
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
