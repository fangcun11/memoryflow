import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  title: string
  message?: string
  confirmText?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * 应用内确认对话框。
 * 为什么不用 window.confirm()：内嵌 webview / 部分 iframe 环境会静默禁用
 * confirm（不弹窗、直接返回 false），删除操作会「点了没反应」。
 * 这里用受控对话框保证任何宿主环境行为一致。
 */
export default function ConfirmDialog({
  title,
  message,
  confirmText = '确认',
  danger = false,
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onConfirm])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/20 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-canvas rounded-2xl w-full max-w-sm p-5 lg:p-6"
        style={{ boxShadow: '0 8px 24px #14141320' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              danger ? 'bg-error-light text-error' : 'bg-amber-light text-amber'
            }`}
          >
            <AlertTriangle className="w-5 h-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h4 className="font-serif text-base font-medium text-ink">{title}</h4>
            {message && <p className="text-sm text-muted mt-1 leading-relaxed">{message}</p>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 lg:py-2 text-sm text-muted font-medium hover:text-ink transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`px-5 py-2.5 lg:py-2 rounded-lg text-sm font-medium transition-colors shadow-sm active:scale-95 ${
              danger
                ? 'bg-error text-white hover:bg-error/90'
                : 'bg-coral text-on-primary hover:bg-coral-active'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
