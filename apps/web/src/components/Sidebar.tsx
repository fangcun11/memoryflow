import { NavLink } from 'react-router-dom'
import { LibraryBig, BrainCircuit, ChartColumnBig, Settings, type LucideIcon } from 'lucide-react'

const navItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: '知识库', icon: LibraryBig },
  { to: '/review', label: '复习', icon: BrainCircuit },
  { to: '/dashboard', label: '看板', icon: ChartColumnBig },
  { to: '/settings', label: '设置', icon: Settings },
]

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex w-60 bg-surface-dark flex-col shrink-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/8">
        <h1 className="font-serif text-xl font-medium tracking-tight text-on-dark">
          政治理论<span className="text-coral">记忆</span>
        </h1>
        <p className="text-xs text-on-dark-soft mt-1">知识库 · 间隔复习 · 智能记忆</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-coral text-on-primary shadow-md'
                  : 'text-on-dark-soft hover:bg-white/6 hover:text-on-dark'
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/8">
        <p className="text-[11px] text-on-dark-soft/60 text-center">v0.1 原型版</p>
      </div>
    </aside>
  )
}
