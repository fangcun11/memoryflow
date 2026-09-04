// ============================================================
// ID 生成：轻量实现，跨端可用（无 DOM / 无 crypto 依赖）
// 如需强 UUID，各端可通过 setIdGenerator 注入自己的实现
// ============================================================

let generator: () => string = fallbackId

let counter = 0

/** 无 uuid 依赖时的兜底实现（碰撞概率对小规模数据可忽略） */
function fallbackId(): string {
  counter = (counter + 1) % 0xffff
  return (
    'id-' +
    Date.now().toString(36) +
    '-' +
    counter.toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  )
}

/** 设置自定义 ID 生成器（如需 uuid v4 在入口处调用） */
export function setIdGenerator(fn: () => string): void {
  generator = fn
}

export function createId(): string {
  return generator()
}
