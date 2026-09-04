// ============================================================
// MemoryFlow Desktop — Electron 主进程
// 数据持久化：userData/memoryflow-data.json（文件存储，卸载浏览器缓存不影响）
// ============================================================

import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'node:path'
import * as fs from 'node:fs'

const DATA_FILE = () => path.join(app.getPath('userData'), 'memoryflow-data.json')

// 内存缓存，避免每次读写都落盘解析
let cache: Record<string, string> | null = null

function loadStore(): Record<string, string> {
  if (cache) return cache
  try {
    cache = JSON.parse(fs.readFileSync(DATA_FILE(), 'utf-8'))
  } catch {
    cache = {}
  }
  return cache!
}

function saveStore(): void {
  if (!cache) return
  const file = DATA_FILE()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  // 原子写：先写临时文件再改名，避免写入中断导致数据损坏
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cache), 'utf-8')
  fs.renameSync(tmp, file)
}

ipcMain.handle('memoryflow:read', (_e, key: string) => {
  return loadStore()[key] ?? null
})

ipcMain.handle('memoryflow:write', (_e, key: string, value: string) => {
  loadStore()[key] = value
  saveStore()
})

ipcMain.handle('memoryflow:remove', (_e, key: string) => {
  delete loadStore()[key]
  saveStore()
})

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 480,
    minHeight: 600,
    backgroundColor: '#FAF5EE',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // 开发模式：MEMORYFLOW_DEV_URL 指向 vite dev server
  const devUrl = process.env.MEMORYFLOW_DEV_URL
  if (devUrl) {
    win.loadURL(devUrl)
    if (process.env.MEMORYFLOW_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    win.loadFile(path.join(__dirname, '../web-dist/index.html'))
  }

  // 渲染进程加载完成后做一次 IPC 写读回环验证（结果输出到 stdout）
  win.webContents.on('did-finish-load', async () => {
    try {
      const probe = { key: '__smoke_test__', value: `ok-${Date.now()}` }
      await win.webContents.executeJavaScript(
        `window.memoryflowDesktop.writeData('${probe.key}', '${probe.value}')`
      )
      const back = await win.webContents.executeJavaScript(
        `window.memoryflowDesktop.readData('${probe.key}')`
      )
      console.log(`SMOKE_TEST: ${back === probe.value ? 'PASS' : 'FAIL'} (read-back=${back})`)
    } catch (err) {
      console.log(`SMOKE_TEST: FAIL (${String(err)})`)
    }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
