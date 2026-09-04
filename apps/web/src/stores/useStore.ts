// ============================================================
// 全局状态管理 — web 端薄封装
// 业务逻辑全部在 @memoryflow/core，此处仅注入 localStorage 适配器
// ============================================================

import { createMemoryFlowStore } from '@memoryflow/core'

const localStorageAdapter = {
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => localStorage.setItem(name, value),
  removeItem: (name: string) => localStorage.removeItem(name),
}

export const useStore = createMemoryFlowStore(localStorageAdapter)

export type { MemoryFlowStore } from '@memoryflow/core'
