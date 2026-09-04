import { Check, X, Info } from 'lucide-react'
import { useToastStore } from './toast'
import type { ToastKind } from './toast'

/**
 * 语义图标：唯一的语义载体（形状本身即信息，不只靠颜色）
 * 成功 = 圆形对勾 / 错误 = 圆形叉 / 提示 = 圆点
 */
const KIND_ICON: Record<ToastKind, typeof Check> = {
  success: Check,
  error: X,
  info: Info,
}

/**
 * Toast 容器 — 挂在 Layout 顶层渲染一次
 *
 * 视觉设计（Claude Design System 延伸）：
 * - 深色炭黑胶囊（surface-dark），与奶油画布形成强对比，是界面里
 *   「命令行/系统反馈」级别的元素——深色即「临时浮层」的心智模型，
 *   与侧边栏同族但更圆润
 * - 语义只用图标形状 + 图标颜色表达，无色块条、无彩色背景
 * - 图标放进 20px 圆形微底内，视觉重心左侧对齐，右侧静默放关闭
 * - 单行 pill 布局，无 border，阴影用深色投影拉出层次
 *
 * 位置：移动端顶部居中（避开 TabBar/键盘），桌面右下角
 * 动画仅 transform + opacity（GPU 加速）
 */
export default function ToastHost() {
  const toasts = useToastStore(s => s.toasts)
  const dismiss = useToastStore(s => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed z-[70] top-4 inset-x-4 flex flex-col items-center gap-2 lg:top-auto lg:bottom-6 lg:right-6 lg:left-auto lg:items-end pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map(t => {
        const Icon = KIND_ICON[t.kind]
        return (
          <div
            key={t.id}
            className="toast-in pointer-events-auto flex items-center gap-3 w-full max-w-sm bg-surface-dark text-on-dark rounded-full pl-2 pr-2 py-2"
            style={{ boxShadow: '0 8px 24px #14141340, 0 2px 6px #14141320' }}
          >
            {/* 语义图标：圆形微底，颜色即语义（形状兜底） */}
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                t.kind === 'success'
                  ? 'bg-success/20 text-[#8fd99e]'
                  : t.kind === 'error'
                    ? 'bg-error/25 text-[#e89a9a]'
                    : 'bg-white/10 text-[#a8c5e8]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
            </span>
            <p className="text-sm leading-snug flex-1 min-w-0 pr-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-on-dark-soft hover:text-on-dark transition-colors shrink-0"
              aria-label="关闭提示"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
