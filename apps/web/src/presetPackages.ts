// ============================================================
// 预置知识库包（纯数据）— 设置页"导入预置知识库"用
// 复用 demoMaterials 的标注语料（agent 创作规范见 docs/agent-annotation-spec.md）
// 导入后走 previewCards 质量分级：低质量兜底卡默认不生成
// ============================================================

import { MATERIALS, CARD_TYPES } from './demoMaterials'

export interface PresetPackage {
  id: string
  title: string
  desc: string
  materials: { title: string; text: string }[]
}

export const PRESET_PACKAGES: PresetPackage[] = [
  {
    id: 'mayuan-basics',
    title: '马原 · 基础考点',
    desc: '唯物辩证法与认识论：高频名解、判断、带解析选择题，含金句高亮与批注',
    materials: [MATERIALS[0], MATERIALS[1]],
  },
  {
    id: 'maozhongte-xmzy',
    title: '毛中特 · 新民主主义革命',
    desc: '总路线 / 三大法宝 / 革命性质，含易混辨析卡（idiom）与判断题',
    materials: [MATERIALS[2]],
  },
]

export const PRESET_CARD_TYPES: CardTypeish[] = [...CARD_TYPES]

type CardTypeish = (typeof CARD_TYPES)[number]
