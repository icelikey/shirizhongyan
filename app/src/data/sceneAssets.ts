export interface SceneAsset {
  id: string
  label: string
  status: "planned" | "ready"
  modelUrl?: string
  previewUrl?: string
  version?: string
  tripoPrompt: string
  gameplayUse: string
}

/**
 * 只接受浏览器可访问的 public URL。登记时可写 `models/...`，页面统一补上 `/`，
 * 避免把 Windows 文件系统路径误当成可部署资源。
 */
export function resolveSceneAssetUrl(value?: string): string | undefined {
  if (!value) return undefined
  const normalized = value.trim().replaceAll("\\", "/")
  if (!normalized || /^[a-zA-Z]:\//.test(normalized)) return undefined
  if (/^(https?:|data:|blob:|\/)/.test(normalized)) return normalized
  return `/${normalized.replace(/^\/+/, "")}`
}

/**
 * Tripo 资产登记表：模型是表现层资源，不进入规则内核。
 * 生成 GLB 后补齐 modelUrl、previewUrl、version 和状态，页面即可切换到真实模型预览。
 * modelUrl/previewUrl 必须指向 app/public 下的可部署路径（例如 models/beast-baize/v1.glb）。
 */
export const SCENE_ASSETS: Record<string, SceneAsset> = {
  baize: {
    id: "beast-baize",
    label: "白泽 · 观星台",
    status: "planned",
    tripoPrompt: "东方山海经异兽白泽，青白玉质骨甲，额生星纹，悬浮于古老观星台，暗金与靛蓝，游戏资产，完整三视图，干净背景",
    gameplayUse: "猜平均数揭晓时的星盘裁判特效",
  },
  eshou: {
    id: "beast-eshou",
    label: "讹兽 · 倒影庭",
    status: "planned",
    tripoPrompt: "山海经异兽讹兽，双面狐形，镜面鳞片与朱砂纹，站在会反射谎言的石庭，东方幻想游戏资产",
    gameplayUse: "狼人杀发言与质询时的倒影干扰特效",
  },
  xuanji: {
    id: "beast-xuanji",
    label: "璇玑 · 算庭机关",
    status: "planned",
    tripoPrompt: "东方机关异兽璇玑，青铜算珠与木质关节，围绕发光算盘运动，山海经幻想，游戏资产，暗色背景",
    gameplayUse: "少数派票决揭晓时的票型柱与算珠动画",
  },
  zhuyin: {
    id: "beast-zhuyin",
    label: "烛阴 · 借时门",
    status: "planned",
    tripoPrompt: "烛龙意象的东方神兽，半龙半蛇，赤金眼瞳，身体盘绕时间门，暗红与金色，山海经幻想游戏资产",
    gameplayUse: "赛马与塔层机关的时间加速、暂停和回放特效",
  },
}
