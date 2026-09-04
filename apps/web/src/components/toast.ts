// ============================================================
// 轻量 Toast 系统 — 纯 zustand + CSS，不引第三方库
// 为什么不用 window.alert()：内嵌 webview / iframe 会静默禁用，
// 用户点击后无任何反馈（与 confirm 同理，见 ConfirmDialog）
// ============================================================

import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (message: string, kind?: ToastKind) => void
  dismiss: (id: number) => void
}

let nextId = 1
/** 自动消失时长 ms：成功/提示 2.4s，错误 3.6s（错误需要更长的阅读时间） */
const DURATION: Record<ToastKind, number> = { success: 2400, info: 2400, error: 3600 }

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, kind = 'success') => {
    const id = nextId++
    set(s => ({ toasts: [...s.toasts.slice(-2), { id, kind, message }] }))
    setTimeout(() => get().dismiss(id), DURATION[kind])
  },
  dismiss: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

/** 命令式调用：任意非组件代码（store action 后、事件回调里）都能触发 */
export const toast = (message: string, kind?: ToastKind) => useToastStore.getState().push(message, kind)
