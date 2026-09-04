// ============================================================
// 全局状态管理 — web/desktop 端薄封装
// 业务逻辑全部在 @memoryflow/core，此处仅注入存储适配器：
// - Electron 环境 → 主进程文件存储（IPC，userData/memoryflow-data.json）
// - 浏览器环境  → localStorage
// ============================================================

import { createMemoryFlowStore, type StorageAdapter } from '@memoryflow/core'

interface ElectronBridge {
  readData: (key: string) => Promise<string | null>
  writeData: (key: string, value: string) => Promise<void>
  removeData: (key: string) => Promise<void>
}

function getElectronBridge(): ElectronBridge | null {
  // preload 通过 contextBridge 挂载
  const bridge = (window as unknown as { memoryflowDesktop?: ElectronBridge })
    .memoryflowDesktop
  return bridge ?? null
}

const localStorageAdapter: StorageAdapter = {
  getItem: name => localStorage.getItem(name),
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: name => localStorage.removeItem(name),
}

const electronAdapter: StorageAdapter = {
  getItem: name => getElectronBridge()?.readData(name) ?? null,
  setItem: (name, value) => {
    const bridge = getElectronBridge()
    if (bridge) return bridge.writeData(name, value)
  },
  removeItem: name => {
    const bridge = getElectronBridge()
    if (bridge) return bridge.removeData(name)
  },
}

export const useStore = createMemoryFlowStore(
  getElectronBridge() ? electronAdapter : localStorageAdapter
)

export type { MemoryFlowStore } from '@memoryflow/core'
