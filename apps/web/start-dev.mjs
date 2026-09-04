// 后台启动脚本：避免 shell 工作目录漂移，直接用 vite JS API 指定 root
import { createServer } from 'vite'

const root = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const server = await createServer({
  root,
  server: { port: 5175, strictPort: true, host: '127.0.0.1' },
})

await server.listen()
console.log('DEV SERVER READY: http://localhost:5175')
