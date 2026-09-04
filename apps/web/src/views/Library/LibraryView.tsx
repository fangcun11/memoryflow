import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import BlockList from './BlockList'
import ImportModal from './ImportModal'
import GeneratePanel from './GeneratePanel'

export default function LibraryView() {
  const { documents, blocks, tags } = useStore()
  const [showImport, setShowImport] = useState(false)
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTag, setFilterTag] = useState<string | null>(null)

  const filteredBlocks = blocks.filter(block => {
    const matchSearch =
      !searchQuery ||
      block.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      block.title?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchTag = !filterTag || block.tags.includes(filterTag)
    return matchSearch && matchTag
  })

  const totalCards = useStore(s => s.cards.length)

  return (
    <div className="h-full flex flex-col">
      {/* Header — Claude cream header with generous padding */}
      <header className="px-4 lg:px-8 py-4 lg:py-6 border-b border-hairline bg-canvas shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-serif text-2xl lg:text-[1.75rem] font-medium text-ink tracking-tight">
              知识库
            </h2>
            <p className="text-sm text-muted mt-1">
              {documents.length} 个文档 · {blocks.length} 个知识块 · {totalCards} 张卡片
            </p>
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="shrink-0 inline-flex items-center gap-2 px-4 lg:px-5 py-2.5 bg-coral text-on-primary rounded-lg text-sm font-medium hover:bg-coral-active transition-colors shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            导入材料
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2 lg:gap-3 mt-3 lg:mt-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-soft" strokeWidth={2} />
            <input
              type="text"
              placeholder="搜索知识块..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-card border border-hairline rounded-lg text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-coral focus:shadow-ring-focus transition-all"
            />
          </div>
          <select
            value={filterTag || ''}
            onChange={e => setFilterTag(e.target.value || null)}
            className="px-3 py-2.5 bg-surface-card border border-hairline rounded-lg text-sm text-ink focus:outline-none focus:border-coral transition-all"
          >
            <option value="">全部标签</option>
            {tags.map(tag => (
              <option key={tag.id} value={tag.name}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Content — pb 需覆盖 GeneratePanel 高度（static 布局时不需要，因为不重叠） */}
      <div className="flex-1 overflow-auto p-4 lg:p-8">
        {blocks.length === 0 ? (
          <EmptyState onImport={() => setShowImport(true)} />
        ) : (
          <BlockList
            blocks={filteredBlocks}
            selectedIds={selectedBlockIds}
            onToggleSelect={id =>
              setSelectedBlockIds(prev =>
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
              )
            }
          />
        )}
      </div>

      {/* Generate Panel */}
      {selectedBlockIds.length > 0 && (
        <GeneratePanel
          selectedCount={selectedBlockIds.length}
          onGenerate={types => {
            useStore.getState().generateFromBlocks(selectedBlockIds, types)
            setSelectedBlockIds([])
          }}
          onClear={() => setSelectedBlockIds([])}
        />
      )}

      {/* Import Modal */}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20">
      <div className="w-20 h-20 rounded-2xl bg-surface-soft flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-muted-soft"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
          />
        </svg>
      </div>
      <h3 className="font-serif text-xl font-medium text-ink mb-2">知识库空空如也</h3>
      <p className="text-muted text-sm mb-6 max-w-sm leading-relaxed">
        导入你的学习材料（教材、讲义、真题），软件会自动分块并生成记忆卡片
      </p>
      <button
        onClick={onImport}
        className="px-6 py-3 bg-coral text-on-primary rounded-lg text-sm font-medium hover:bg-coral-active transition-colors shadow-sm"
      >
        导入第一份材料
      </button>
    </div>
  )
}
