// ============================================================
// MemoryFlow Mobile — 存储适配器 + store 实例
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createMemoryFlowStore, type StorageAdapter } from '@memoryflow/core'

const asyncStorageAdapter: StorageAdapter = {
  getItem: name => AsyncStorage.getItem(name),
  setItem: (name, value) => AsyncStorage.setItem(name, value),
  removeItem: name => AsyncStorage.removeItem(name),
}

export const useStore = createMemoryFlowStore(asyncStorageAdapter)
