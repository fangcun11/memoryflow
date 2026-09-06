import { useState } from 'react'
import { Download, Upload, Trash2, X, PackageOpen, Check, Loader2 } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import { previewCards } from '@memoryflow/core'
import { PRESET_PACKAGES, PRESET_CARD_TYPES } from '../../presetPackages'
import type { PresetPackage } from '../../presetPackages'
import ConfirmDialog from '../../components/ConfirmDialog'
import { toast } from '../../components/toast'

const PRESET_FLAG_KEY = (id: string) => `memoryflow-preset-${id}`

export default function SettingsView() {
  const { documents, settings, updateSettings, exportData, importData, clearAll } = useStore()
  const [showExport, setShowExport] = useState(false)
  const [exportText, setExportText] = useState('')
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [localFlags, setLocalFlags] = useState<Set<string>>(() => {
    const s = new Set<string>()
    try {
      for (const pkg of PRESET_PACKAGES) {
        if (localStorage.getItem(PRESET_FLAG_KEY(pkg.id))) s.add(pkg.id)
      }
    } catch { /* ignore */ }
    return s
  })

  // 已导入判定：本地标记 或 文档里已有同名材料（防止重复导入）
  const isImported = (pkg: PresetPackage) =>
    localFlags.has(pkg.id) || pkg.materials.every(m => documents.some(d => d.title === m.title))

  const handleImportPackage = (pkg: PresetPackage) => {
    if (isImported(pkg)) return
    setImportingId(pkg.id)
    // 用微任务让按钮先进入 loading 态
    setTimeout(() => {
      try {
        const store = useStore.getState()
        const allBlockIds: string[] = []
        for (const m of pkg.materials) {
          const { blocks } = store.importText(m.title, m.text)
          allBlockIds.push(...blocks.map(b => b.id))
        }
        // 质量过滤：与知识库预览确认同口径，低质量兜底卡不生成
        const importedBlocks = useStore.getState().blocks.filter(b => allBlockIds.includes(b.id))
        const previews = previewCards(importedBlocks, PRESET_CARD_TYPES)
        const good = previews.filter(p => p.quality !== 'low')
        const { added, updated } = store.generateFromPreviews(good)
        try { localStorage.setItem(PRESET_FLAG_KEY(pkg.id), '1') } catch { /* ignore */ }
        setLocalFlags(prev => new Set(prev).add(pkg.id))
        toast(`已导入「${pkg.title}」：${pkg.materials.length} 篇材料 · ${added} 张新卡片${updated ? ` · 更新 ${updated} 张` : ''}`)
      } catch (e) {
        console.error('预置包导入失败:', e)
        toast('导入失败，请重试', 'error')
      } finally {
        setImportingId(null)
      }
    }, 30)
  }

  const handleExport = () => {
    setExportText(exportData())
    setShowExport(true)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText)
      toast('已复制到剪贴板')
      setShowExport(false)
    } catch {
      toast('复制失败，请手动选择文本复制', 'error')
    }
  }

  const handleImport = () => {
    if (!importText.trim()) return
    importData(importText)
    setImportText('')
    setShowImport(false)
    toast('导入成功')
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

      {/* 预置知识库 */}
      <section className="bg-surface-card border border-hairline rounded-xl p-6 mb-6">
        <h3 className="font-serif text-base font-medium text-ink mb-1">预置知识库</h3>
        <p className="text-xs text-muted-soft mb-4">内置标注语料一键导入，导入时自动按标注出卡并过滤低质量兜底卡</p>
        <div className="space-y-3">
          {PRESET_PACKAGES.map(pkg => {
            const imported = isImported(pkg)
            const importing = importingId === pkg.id
            return (
              <div
                key={pkg.id}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-lg border transition-colors ${
                  imported ? 'bg-success-light/50 border-success/20' : 'bg-surface-soft border-hairline hover:border-coral/40'
                }`}
              >
                <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${imported ? 'bg-success-light' : 'bg-coral-light'}`}>
                  {imported
                    ? <Check className="w-5 h-5 text-success" strokeWidth={2} />
                    : <PackageOpen className="w-5 h-5 text-coral" strokeWidth={1.5} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-body-strong">{pkg.title}</div>
                  <div className="text-xs text-muted mt-0.5 leading-relaxed">{pkg.desc}</div>
                  <div className="text-[11px] text-muted-soft mt-0.5">{pkg.materials.length} 篇材料 · 标注语料</div>
                </div>
                <button
                  onClick={() => handleImportPackage(pkg)}
                  disabled={imported || importing}
                  className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                    imported
                      ? 'bg-success-light text-success cursor-default'
                      : 'bg-coral text-on-primary hover:bg-coral-active shadow-sm disabled:opacity-60'
                  }`}
                >
                  {importing ? (
                    <span className="inline-flex items-center gap-1.5"><Loader2 className="w-4 h-4 animate-spin" />导入中</span>
                  ) : imported ? (
                    '已导入'
                  ) : (
                    '导入'
                  )}
                </button>
              </div>
            )
          })}
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
            toast('已清空所有数据')
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
