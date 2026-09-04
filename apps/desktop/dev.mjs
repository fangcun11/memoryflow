// 开发模式：先起 vite dev server，再拉 Electron 加载它
import { spawn } from 'node:child_process'
import { createServer } from 'vite'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(here, '../web')
const ROOT = path.resolve(here, '../..')
const NODE = path.join(ROOT, 'node_modules/.bin/')

// 1. 构建主进程
await build({
  entryPoints: [path.join(here, 'main.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(here, 'dist/main.js'),
  external: ['electron'],
})
await build({
  entryPoints: [path.join(here, 'preload.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(here, 'dist/preload.cjs'),
  external: ['electron'],
})

// 2. 启动 vite dev server（web 端）
const server = await createServer({
  root: webRoot,
  server: { port: 5176, strictPort: true, host: '127.0.0.1' },
})
await server.listen()
console.log('DEV SERVER READY: http://localhost:5176')

// 3. 启动 Electron
const electronBin = path.join(ROOT, 'node_modules/electron/cli.js')
const child = spawn(process.execPath, [electronBin, here], {
  env: { ...process.env, MEMORYFLOW_DEV_URL: 'http://localhost:5176' },
  stdio: 'inherit',
  cwd: here,
})

child.on('exit', async code => {
  await server.close()
  process.exit(code ?? 0)
})
