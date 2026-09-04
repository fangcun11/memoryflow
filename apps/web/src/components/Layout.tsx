import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TabBar from './TabBar'

/**
 * 双导航布局：
 * - ≥lg（桌面）：左侧暗色侧边栏，与原版完全一致
 * - <lg（移动）：底部 Tab Bar，侧边栏隐藏
 * h-dvh 保证移动端浏览器地址栏收展时高度正确
 *
 * 结构：外层横向 flex 放侧边栏；内容区纵向 flex（main 在上、TabBar 在底部），
 * 保证 TabBar 永远水平居底而不是被当作 flex item 挤到侧边。
 */
export default function Layout() {
  return (
    <div className="flex h-dvh bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto min-h-0">
          <Outlet />
        </main>
        <TabBar />
      </div>
    </div>
  )
}
