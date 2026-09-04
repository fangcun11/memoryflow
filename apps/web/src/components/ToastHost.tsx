import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { useToastStore } from './toast'
import type { ToastKind } from './toast'

/** 语义色映射：图标 + 左侧强调条（不只靠颜色区分语义） */
const KIND_STYLE: Record<ToastKind, { icon: typeof CheckCircle2; bar: string; iconColor: string }> = {
  success: { icon: CheckCircle2, bar: 'bg-success', iconColor: 'text-success' },
  error: { icon: XCircle, bar: 'bg-error', iconColor: 'text-error' },
  info: { icon: Info, bar: 'bg-blue', iconColor: 'text-blue' },
}

/**
 * Toast 容器 — 挂在 Layout 顶层渲染一次
 * 移动端：顶部居中（避开底部 Tab Bar 与键盘区）
 * 桌面端：右下角（Mail 类应用惯例，不遮内容）
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
        const style = KIND_STYLE[t.kind]
        return (
          <div
            key={t.id}
            className="toast-in pointer-events-auto flex items-stretch w-full max-w-sm bg-surface-card rounded-xl overflow-hidden border border-hairline"
            style={{ boxShadow: '0 8px 24px #14141320' }}
          >
            <div className={`w-1 shrink-0 ${style.bar}`} aria-hidden="true" />
            <div className="flex items-center gap-2.5 px-3.5 py-3 flex-1 min-w-0">
              <style.icon className={`w-4.5 h-4.5 w-[18px] h-[18px] shrink-0 ${style.iconColor}`} strokeWidth={2} />
              <p className="text-sm text-ink leading-snug flex-1">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="w-6 h-6 rounded-md hover:bg-surface-soft flex items-center justify-center text-muted-soft hover:text-ink transition-colors shrink-0"
                aria-label="关闭提示"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
