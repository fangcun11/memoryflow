// ============================================================
// MemoryFlow Desktop — preload
// 通过 contextBridge 安全暴露数据读写接口给渲染进程
// ============================================================

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('memoryflowDesktop', {
  readData: (key: string) => ipcRenderer.invoke('memoryflow:read', key),
  writeData: (key: string, value: string) =>
    ipcRenderer.invoke('memoryflow:write', key, value),
  removeData: (key: string) => ipcRenderer.invoke('memoryflow:remove', key),
})
