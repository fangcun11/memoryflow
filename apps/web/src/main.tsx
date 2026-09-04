import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { seedDemoDataIfFirstRun } from './demoSeed'

// 首次访问注入演示数据（在 render 前、store hydrate 后执行）
seedDemoDataIfFirstRun()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
