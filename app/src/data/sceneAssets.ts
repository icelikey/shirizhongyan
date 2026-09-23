export interface SceneAsset {
  id: string
  label: string
  status: "planned" | "ready"
  modelUrl?: string
  tripoPrompt: string
  gameplayUse: string
}

/**
 * Tripo 资产登记表：模型是表现层资源，不进入规则内核。
 * 生成 GLB 后只需补 modelUrl 和状态，页面即可切换到真实模型预览。
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
