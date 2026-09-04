// ============================================================
// 政治理论学习记忆软件 — 核心类型定义（跨端共享）
// ============================================================

/** 文档 */
export interface Document {
  id: string
  title: string
  fileType: 'txt' | 'md' | 'docx' | 'pdf' | 'epub' | 'paste'
  createdAt: number
}

/** 知识块 */
export interface KnowledgeBlock {
  id: string
  documentId: string
  content: string
  title?: string
  tags: string[]
  difficulty: number // 1-5
  relatedIds: string[]
  createdAt: number
  updatedAt: number
}

/** 标签 */
export interface Tag {
  id: string
  name: string
  parentId?: string
}

/** 卡片类型 */
export type CardType = 'qa' | 'cloze' | 'compare' | 'essay'

/** 卡片 */
export interface Card {
  id: string
  blockId: string
  type: CardType
  front: string
  back: string
  // SM-2 调度字段
  easeFactor: number
  interval: number
  repetitions: number
  dueDate: number
  lapses: number
  createdAt: number
}

/** 复习评分 */
export type ReviewRating = 0 | 2 | 4 | 5

/** 复习日志 */
export interface ReviewLog {
  id: number
  cardId: string
  rating: ReviewRating
  reviewedAt: number
  timeSpent: number // ms
}

/** 复习队列类型 */
export type QueueType = 'due' | 'new' | 'hard' | 'ahead'

/** 学习设置 */
export interface LearningSettings {
  newCardsPerDay: number
  reviewLimit: number
  hardThreshold: number // lapses >= N 视为难卡
  easeThreshold: number // EF < N 视为难卡
}

/** 持久化的业务数据（不含运行时复习会话） */
export interface PersistedData {
  documents: Document[]
  blocks: KnowledgeBlock[]
  tags: Tag[]
  cards: Card[]
  reviewLogs: ReviewLog[]
  settings: LearningSettings
}

/** 全局状态 */
export interface AppState extends PersistedData {
  // 当前复习队列（运行时状态，不持久化）
  reviewQueue: Card[]
  currentReviewIndex: number
  reviewSession: {
    started: number
    reviewed: number
    correct: number
  }
}

/** 存储适配器：由各端提供实现（web=localStorage, rn=AsyncStorage, mp=wx.storage） */
export interface StorageAdapter {
  getItem: (name: string) => Promise<string | null> | string | null
  setItem: (name: string, value: string) => Promise<void> | void
  removeItem: (name: string) => Promise<void> | void
}
