import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // 相对路径：兼容 Electron file:// 协议加载
  base: './',
  plugins: [react(), tailwindcss()],
})
