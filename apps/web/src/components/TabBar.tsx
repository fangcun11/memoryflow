import { NavLink, useLocation } from 'react-router-dom'
import { LibraryBig, BrainCircuit, ChartColumnBig, Settings, type LucideIcon } from 'lucide-react'
import { useStore } from '../stores/useStore'

const navItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: '知识库', icon: LibraryBig },
  { to: '/review', label: '复习', icon: BrainCircuit },
  { to: '/dashboard', label: '看板', icon: ChartColumnBig },
  { to: '/settings', label: '设置', icon: Settings },
]

/**
 * 移动端底部导航栏（< lg 断点显示）
 * - 复习 Tab 显示待复习角标（复习中显示剩余张数）
 * - 复习进行中整条隐藏，保证沉浸式刷卡
 */
export default function TabBar() {
  const location = useLocation()
  const cards = useStore(s => s.cards)
  const reviewQueue = useStore(s => s.reviewQueue)
  const currentReviewIndex = useStore(s => s.currentReviewIndex)

  const reviewing =
    location.pathname === '/review' &&
    reviewQueue.length > 0 &&
    currentReviewIndex < reviewQueue.length

  const now = Date.now()
  const dueCount = cards.filter(c => c.dueDate <= now && c.repetitions > 0).length
  const newCount = cards.filter(c => c.repetitions === 0).length
  const badge = reviewing
    ? reviewQueue.length - currentReviewIndex
    : dueCount + newCount

  if (reviewing) return null

  return (
    <nav className="lg:hidden shrink-0 bg-canvas border-t border-hairline flex pb-[env(safe-area-inset-bottom)] z-40">
      {navItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 pt-2.5 pb-1.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-coral' : 'text-muted-soft hover:text-muted'
            }`
          }
        >
          <span className="relative">
            <item.icon className="w-[22px] h-[22px]" strokeWidth={1.75} />
            {item.to === '/review' && badge > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-coral text-on-primary text-[9px] font-medium flex items-center justify-center">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
