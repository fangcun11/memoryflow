import { useState } from 'react'
import { X, ClipboardPaste, Check } from 'lucide-react'
import { useStore } from '../../stores/useStore'

interface Props {
  onClose: () => void
}

/**
 * 导入材料弹层
 * - 移动端：全屏 Bottom Sheet，textarea 自动撑满剩余高度，键盘弹起体验好
 * - 桌面端：居中弹窗，与原版一致
 */
export default function ImportModal({ onClose }: Props) {
  const importText = useStore(s => s.importText)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [step, setStep] = useState<'input' | 'done'>('input')
  const [result, setResult] = useState<{ docTitle: string; blockCount: number } | null>(null)

  const handleImport = () => {
    if (!content.trim()) return
    const docTitle = title.trim() || '未命名文档'
    const { document, blocks } = importText(docTitle, content)
    setResult({ docTitle: document.title, blockCount: blocks.length })
    setStep('done')
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setContent(text)
      if (!title) {
        const firstLine = text.split('\n')[0].slice(0, 30)
        setTitle(firstLine)
      }
    } catch {
      // clipboard API may need permission
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-ink/20 backdrop-blur-sm">
      <div
        className="sheet-up lg:animate-none bg-canvas rounded-t-2xl sm:rounded-2xl lg:rounded-2xl w-full lg:max-w-2xl max-w-full lg:max-h-[85vh] h-full sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden sm:m-6"
        style={{ boxShadow: '0 8px 24px #14141320' }}
      >
        {/* Header */}
        <div className="px-5 lg:px-6 py-4 border-b border-hairline flex items-center justify-between shrink-0">
          <h3 className="font-serif text-lg font-medium text-ink">导入学习材料</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-surface-soft active:bg-surface-soft flex items-center justify-center text-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto p-5 lg:p-6">
          {step === 'input' && (
            <div className="space-y-4 h-full flex flex-col">
              <div className="shrink-0">
                <label className="block text-sm font-medium text-body-strong mb-1.5">文档标题</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="例如：马克思主义基本原理 · 第三章"
                  className="w-full px-4 py-2.5 bg-surface-card border border-hairline rounded-lg text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-coral focus:shadow-ring-focus transition-all"
                />
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between mb-1.5 shrink-0">
                  <label className="text-sm font-medium text-body-strong">内容</label>
                  <button
                    onClick={handlePaste}
                    className="inline-flex items-center gap-1 text-xs text-coral hover:text-coral-active font-medium transition-colors active:text-coral-active"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    从剪贴板粘贴
                  </button>
                </div>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={'粘贴你的学习材料...\n\n支持纯文本、Markdown 格式。\n软件会自动按段落分块。'}
                  className="w-full flex-1 min-h-[160px] lg:h-64 px-4 py-3 bg-surface-card border border-hairline rounded-lg text-sm text-ink resize-none focus:outline-none focus:border-coral focus:shadow-ring-focus transition-all leading-relaxed"
                />
              </div>
              <p className="text-xs text-muted-soft shrink-0">
                提示：导入后会自动按段落切分为知识块，你可以在知识库中编辑和打标签。
              </p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-success-light flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-success" strokeWidth={2.5} />
              </div>
              <h4 className="font-serif text-lg font-medium text-ink mb-1">导入成功</h4>
              <p className="text-sm text-muted">
                「{result.docTitle}」已生成 <span className="font-medium text-body-strong">{result.blockCount}</span> 个知识块
              </p>
            </div>
          )}
        </div>

        {/* Footer — 移动端贴近安全区 */}
        <div className="px-5 lg:px-6 py-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] lg:pb-4 border-t border-hairline flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 lg:py-2 text-sm text-muted font-medium hover:text-ink transition-colors"
          >
            {step === 'done' ? '关闭' : '取消'}
          </button>
          {step === 'input' && (
            <button
              onClick={handleImport}
              disabled={!content.trim()}
              className="px-5 py-2.5 bg-coral text-on-primary rounded-lg text-sm font-medium hover:bg-coral-active transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              确认导入
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
