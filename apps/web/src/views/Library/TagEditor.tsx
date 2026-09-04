import { useState } from 'react'
import { useStore } from '../../stores/useStore'
import type { Tag } from '@memoryflow/core'

interface Props {
  blockId: string
  currentTags: string[]
  allTags: Tag[]
  onClose: () => void
}

export default function TagEditor({ blockId, currentTags, allTags, onClose }: Props) {
  const updateBlockTags = useStore(s => s.updateBlockTags)
  const addTag = useStore(s => s.addTag)
  const [newTagName, setNewTagName] = useState('')

  const toggleTag = (tagName: string) => {
    const newTags = currentTags.includes(tagName)
      ? currentTags.filter(t => t !== tagName)
      : [...currentTags, tagName]
    updateBlockTags(blockId, newTags)
  }

  const handleAddTag = () => {
    const name = newTagName.trim()
    if (!name) return
    if (!allTags.find(t => t.name === name)) {
      addTag(name)
    }
    if (!currentTags.includes(name)) {
      updateBlockTags(blockId, [...currentTags, name])
    }
    setNewTagName('')
  }

  return (
    <div className="pt-3">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {allTags.map(tag => (
          <button
            key={tag.id}
            onClick={() => toggleTag(tag.name)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              currentTags.includes(tag.name)
                ? 'bg-coral text-on-primary shadow-sm'
                : 'bg-surface-soft text-body hover:bg-surface-strong'
            }`}
          >
            {tag.name}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newTagName}
          onChange={e => setNewTagName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddTag()}
          placeholder="新标签..."
          className="flex-1 px-3 py-1.5 bg-surface-card border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-coral transition-all"
        />
        <button
          onClick={handleAddTag}
          disabled={!newTagName.trim()}
          className="px-3 py-1.5 bg-surface-soft text-body rounded-lg text-xs font-medium hover:bg-surface-strong transition-colors disabled:opacity-40"
        >
          添加
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-muted-soft hover:text-ink text-xs font-medium transition-colors"
        >
          完成
        </button>
      </div>
    </div>
  )
}
