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
  annotations?: BlockAnnotation[]
}

/** 标签 */
export interface Tag {
  id: string
  name: string
  parentId?: string
}

/** 卡片类型 */
export type CardType = 'qa' | 'cloze' | 'compare' | 'essay' | 'recall' | 'choice' | 'judge'

/** 知识块内标注（由标注语法解析而来：**名解** / {{填空}} / ?选择 / !判断） */
export interface BlockAnnotation {
  type: 'recall' | 'cloze' | 'choice' | 'judge'
  start: number // 相对块 content 的偏移
  end: number
  groupId?: number // cloze 分组（{{c1::}} → 1）
  stem?: string // choice 题干（| 前部分）
  answer?: string // choice 的正确项（options 中第一个）
  options?: string[] // choice 的全部选项（第一个为正确项）
  judgeTrue?: boolean // judge 的答案：陈述为真
}

/** 卡片 */
export interface Card {
  id: string
  blockId: string
  type: CardType
  front: string
  back: string
  // 稳定身份：blockId + 标注签名（如 "recall@12" / "choice@30" / "rule:qa"）。
  // 同身份重新生成时更新卡面并保留 SM-2 调度状态，而不是产生重复卡。
  identity?: string
  // SM-2 调度字段
  easeFactor: number
  interval: number
  repetitions: number
  dueDate: number
  lapses: number
  createdAt: number
  // choice / judge 专用
  options?: string[]
  answerIndex?: number
  judgeAnswer?: boolean
}

/** 卡片生成预览项：质量分级供确认层默认勾选 */
export interface CardPreview {
  card: Card
  /** annotated=由标注生成；ok=规则生成且句式匹配；low=规则兜底，建议人工确认 */
  quality: 'annotated' | 'ok' | 'low'
  note?: string // low 时给用户的原因说明
}

/** 复习评分 */
export type ReviewRating = 0 | 2 | 4 | 5

/** 一次评分前的快照（供撤销使用，运行时状态不持久化） */
export interface ReviewSnapshot {
  card: Card // 评分前的卡片状态
  index: number // 评分时的队列位置
  logId: number // 本次写入的日志 id
  reviewed: number
  correct: number
  requeued: boolean // 本次评分是否触发了重排（rating 0）
}

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
  lastReviewSnapshot: ReviewSnapshot | null
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
