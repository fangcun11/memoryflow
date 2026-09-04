import { useState } from 'react'
import { Download, Upload, Trash2, X } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import ConfirmDialog from '../../components/ConfirmDialog'

export default function SettingsView() {
  const { settings, updateSettings, exportData, importData, clearAll } = useStore()
  const [showExport, setShowExport] = useState(false)
  const [exportText, setExportText] = useState('')
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const handleExport = () => {
    setExportText(exportData())
    setShowExport(true)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText)
      alert('已复制到剪贴板')
    } catch { /* fallback */ }
  }

  const handleImport = () => {
    if (!importText.trim()) return
    importData(importText)
    setImportText('')
    setShowImport(false)
    alert('导入成功！')
  }

  return (
    <div className="h-full overflow-auto p-4 lg:p-8 max-w-2xl mx-auto">
      <header className="mb-6 lg:mb-8">
        <h2 className="font-serif text-2xl lg:text-[1.75rem] font-medium text-ink tracking-tight">设置</h2>
        <p className="text-sm text-muted mt-1">调整学习偏好和管理数据</p>
      </header>

      {/* 学习偏好 */}
      <section className="bg-surface-card border border-hairline rounded-xl p-6 mb-6">
        <h3 className="font-serif text-base font-medium text-ink mb-4">学习偏好</h3>
        <div className="space-y-5">
          <SettingRow label="每日新卡上限" desc="每天最多学习的新卡片数量">
            <input type="number" value={settings.newCardsPerDay}
              onChange={e => updateSettings({ newCardsPerDay: Math.max(1, parseInt(e.target.value) || 1) })}
              min={1} max={100}
              className="w-24 px-3 py-2 bg-surface-soft border border-hairline rounded-lg text-sm text-ink text-center focus:outline-none focus:border-coral transition-all"
            />
          </SettingRow>
          <SettingRow label="每日复习上限" desc="每天最多复习的卡片数量">
            <input type="number" value={settings.reviewLimit}
              onChange={e => updateSettings({ reviewLimit: Math.max(1, parseInt(e.target.value) || 1) })}
              min={1} max={500}
              className="w-24 px-3 py-2 bg-surface-soft border border-hairline rounded-lg text-sm text-ink text-center focus:outline-none focus:border-coral transition-all"
            />
          </SettingRow>
          <SettingRow label="难卡判定 — 遗忘次数" desc="连续遗忘 N 次以上视为难卡">
            <input type="number" value={settings.hardThreshold}
              onChange={e => updateSettings({ hardThreshold: Math.max(1, parseInt(e.target.value) || 1) })}
              min={1} max={10}
              className="w-24 px-3 py-2 bg-surface-soft border border-hairline rounded-lg text-sm text-ink text-center focus:outline-none focus:border-coral transition-all"
            />
          </SettingRow>
          <SettingRow label="难卡判定 — 容易度因子" desc="EF 低于此值视为难卡">
            <input type="number" value={settings.easeThreshold}
              onChange={e => updateSettings({ easeThreshold: Math.max(1.3, parseFloat(e.target.value) || 1.3) })}
              min={1.3} max={3.0} step={0.1}
              className="w-24 px-3 py-2 bg-surface-soft border border-hairline rounded-lg text-sm text-ink text-center focus:outline-none focus:border-coral transition-all"
            />
          </SettingRow>
        </div>
      </section>

      {/* 数据管理 */}
      <section className="bg-surface-card border border-hairline rounded-xl p-6 mb-6">
        <h3 className="font-serif text-base font-medium text-ink mb-4">数据管理</h3>
        <div className="space-y-3">
          <DataAction
            icon={<Download className="w-5 h-5 text-muted-soft" strokeWidth={1.5} />}
            title="导出数据" desc="将所有数据导出为 JSON 文件"
            onClick={handleExport}
          />
          <DataAction
            icon={<Upload className="w-5 h-5 text-muted-soft" strokeWidth={1.5} />}
            title="导入数据" desc="从 JSON 文件恢复数据"
            onClick={() => setShowImport(true)}
          />
          <button
            onClick={() => setShowClearConfirm(true)}
            className="w-full flex items-center justify-between px-4 py-3 bg-error-light rounded-lg hover:bg-error/10 transition-colors"
          >
            <div className="text-left">
              <div className="text-sm font-medium text-error">清空数据</div>
              <div className="text-xs text-error/60">删除所有文档、知识块和卡片</div>
            </div>
            <Trash2 className="w-5 h-5 text-error/60" strokeWidth={1.5} />
          </button>
        </div>
      </section>

      {/* 关于 */}
      <section className="bg-surface-card border border-hairline rounded-xl p-6">
        <h3 className="font-serif text-base font-medium text-ink mb-2">关于</h3>
        <p className="text-sm text-muted">政治理论记忆 v0.1 原型版 — 基于 SM-2 间隔重复算法的智能记忆引擎</p>
        <p className="text-xs text-muted-soft mt-2">数据存储在本地浏览器中，无需联网</p>
      </section>

      {/* Clear Confirm */}
      {showClearConfirm && (
        <ConfirmDialog
          title="清空所有数据？"
          message="将删除所有文档、知识块、卡片和复习记录，此操作不可恢复。建议先导出备份。"
          confirmText="清空"
          danger
          onConfirm={() => {
            clearAll()
            setShowClearConfirm(false)
          }}
          onClose={() => setShowClearConfirm(false)}
        />
      )}

      {/* Export Modal */}
      {showExport && (
        <Modal onClose={() => setShowExport(false)}>
          <h4 className="font-serif text-lg font-medium text-ink mb-3">导出数据</h4>
          <textarea value={exportText} readOnly
            className="w-full h-48 px-4 py-3 bg-surface-soft border border-hairline rounded-lg text-xs font-mono resize-none text-ink"
          />
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowExport(false)} className="px-4 py-2.5 sm:py-2 text-sm text-muted font-medium hover:text-ink transition-colors">关闭</button>
            <button onClick={handleCopy} className="px-4 py-2.5 sm:py-2 bg-coral text-on-primary rounded-lg text-sm font-medium hover:bg-coral-active transition-colors active:scale-95">复制到剪贴板</button>
          </div>
        </Modal>
      )}

      {/* Import Modal */}
      {showImport && (
        <Modal onClose={() => setShowImport(false)}>
          <h4 className="font-serif text-lg font-medium text-ink mb-3">导入数据</h4>
          <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="粘贴 JSON 数据..."
            className="w-full h-48 px-4 py-3 bg-surface-soft border border-hairline rounded-lg text-xs font-mono resize-none text-ink focus:outline-none focus:border-coral transition-all"
          />
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowImport(false)} className="px-4 py-2.5 sm:py-2 text-sm text-muted font-medium hover:text-ink transition-colors">取消</button>
            <button onClick={handleImport} disabled={!importText.trim()}
              className="px-4 py-2.5 sm:py-2 bg-coral text-on-primary rounded-lg text-sm font-medium hover:bg-coral-active transition-colors disabled:opacity-40 active:scale-95"
            >导入</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
      <div>
        <div className="text-sm font-medium text-body-strong">{label}</div>
        <div className="text-xs text-muted mt-0.5">{desc}</div>
      </div>
      {children}
    </div>
  )
}

function DataAction({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3 bg-surface-soft rounded-lg hover:bg-surface-strong transition-colors">
      <div className="text-left">
        <div className="text-sm font-medium text-body-strong">{title}</div>
        <div className="text-xs text-muted">{desc}</div>
      </div>
      {icon}
    </button>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-ink/20 backdrop-blur-sm">
      <div className="sheet-up lg:animate-none bg-canvas rounded-t-2xl lg:rounded-xl w-full lg:max-w-lg p-6 relative sm:m-6 sm:rounded-2xl" style={{ boxShadow: '0 8px 24px #14141320' }}>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-lg hover:bg-surface-soft flex items-center justify-center text-muted hover:text-ink transition-colors">
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
        {children}
      </div>
    </div>
  )
}
