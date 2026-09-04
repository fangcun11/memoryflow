// ============================================================
// @memoryflow/core — 跨端共享核心（Web / React Native / 小程序）
// ============================================================

// 类型
export type {
  Document,
  KnowledgeBlock,
  Tag,
  CardType,
  Card,
  ReviewRating,
  ReviewLog,
  QueueType,
  LearningSettings,
  PersistedData,
  AppState,
  StorageAdapter,
} from './types.ts'

// ID
export { createId, setIdGenerator } from './id.ts'

// SM-2 算法
export { sm2Update, predictInterval, formatInterval } from './sm2.ts'

// 文本解析
export { parseTextToBlocks, PRESET_TAGS } from './textParser.ts'

// 卡片生成
export { generateCards, generateCompareCard } from './cardGenerator.ts'

// Store 工厂
export {
  createMemoryFlowStore,
  DEFAULT_SETTINGS,
  type MemoryFlowStore,
  type StoreActions,
} from './createStore'
