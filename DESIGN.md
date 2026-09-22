# 《十日牌局》视觉设计规范

> 代码中有 28 处引用 `design.md` 但该文件缺失。本文档从 `src/index.css`
> 的实际实现 + `public/` 的 101 个素材反向抽取，是唯一权威版本。
> 修改视觉前先读这里，改完同步更新本文档。

---

## 一、设计定位

**墨韵星云 × 赌局金箔**。暗色唯一（`color-scheme: dark`，不做亮色模式）。

气质参考：《十日终焉》的宿命感 + 《赌博默示录》的压迫感 + 东方水墨的留白。
**不是**赛博朋克，**不是**卡通渲染。关键词：金线、印章、颗粒、星云、竖排。

---

## 二、色彩令牌（已落地于 `src/index.css`）

### 底色（五层深度）

```css
--bg-abyss:    #07060B   /* 最深，body 底 */
--bg-ink:      #0C0A13   /* 次深 */
--bg-panel:    #14101C   /* 面板 */
--bg-elevated: #1D1626   /* 浮起元素 */
--bg-felt:     #101A16   /* 牌桌绒面（偏绿）*/
```

### 金（主色，五档）

```css
--gold-100: #F8E9C0   /* 高光 */
--gold-300: #E3C27C   /* 主金，边框与强调 */
--gold-500: #C6A15B   /* 中金 */
--gold-700: #8A6A33   /* 暗金 */
--cinnabar: #D8443C   /* 朱砂，印章与危险 */
--cinnabar-hi: #F0655A
```

### 四花色语义色（**不可改**，与大陆绑定）

```css
--suit-spade:   #8B93F8   /* ♠ 玄渊 · 博弈与欺骗 */
--suit-heart:   #EE6A72   /* ♥ 丹丘 · 心理与谈判 */
--suit-club:    #4ECB9C   /* ♣ 青野 · 计算与概率 */
--suit-diamond: #F2A93B   /* ♦ 金壤 · 资源与竞逐 */
```

这四个色值同时出现在 `src/data/echoes.ts` 的 `SUIT_META` 里（含 glow 变体）。
**改动必须两处同步**，否则 UI 与数据层色彩不一致。

### 文字（三档）

```css
--text-bone:  #F2EAD8   /* 正文 */
--text-dim:   #A89F8D   /* 次要 */
--text-faint: #6E6880   /* 禁用/占位 */
```

### 线条（三档，全部是半透明金）

```css
--line-subtle: rgba(227, 194, 124, 0.10)   /* 分割线 */
--line-gold:   rgba(227, 194, 124, 0.28)   /* 常规边框 */
--line-bright: rgba(246, 227, 180, 0.55)   /* 激活/聚焦 */
```

---

## 三、动效曲线（三条，够用）

```css
--ease-ink:    cubic-bezier(.22, 1, .36, 1)     /* 墨滴入水，常规过渡 */
--ease-snap:   cubic-bezier(.83, 0, .17, 1)     /* 快进快出，卡牌翻转 */
--ease-spring: cubic-bezier(.34, 1.56, .64, 1)  /* 回弹，奖励飞入 */
```

**无障碍要求**（已实现，勿删）：`@media (prefers-reduced-motion: reduce)`
把动画压到 0.01ms、过渡压到 0.15s。新增动效必须能被这条规则覆盖。

---

## 四、已实现的组件类（`@layer components`）

| 类名 | 用途 |
|---|---|
| `.gold-text` | 金字标题（三段渐变 + 光晕） |
| `.vertical-rl` | 竖排文字（`letter-spacing: .3em`） |
| `.card-frame` | 卡牌框：金线描边 + 内阴影 |
| `.panel-bg` | 面板底：深色 + 顶部内高光 |
| `.gold-sweep` | 金箔光扫（hover 触发，0.6s） |
| `.seal-stamp` | 朱砂印章字（`Ma Shan Zheng` 字体） |

### 全局氛围层（两层，已实现）

1. **星云底**：`body` 叠 `bg-nebula-abyss.png` + 径向渐变四角压暗，`fixed` 不随滚动
2. **颗粒噪点**：`body::after` 叠 `texture-noise.png`，512px 平铺，
   `opacity: .05`，`mix-blend-mode: overlay`，`z-index: 60`

这两层是整个视觉风格的地基。**新页面不要覆盖 body 背景**，否则失去统一质感。

---

## 五、字体（5 款，已在 `index.html` 引入）

| 字体 | 字重 | 用途 |
|---|---|---|
| `Noto Sans SC` | 400/500/700 | 正文（`body` 默认） |
| `Noto Serif SC` | 600/900 | 标题衬线 |
| `Ma Shan Zheng` | — | 印章字（`.seal-stamp`） |
| `Cinzel` | 600/700 | 拉丁文装饰（Ten Days Gambit） |
| `JetBrains Mono` | 400/600 | 数值等宽（碎片数、出数） |

已配 `preconnect` 到 `fonts.gstatic.com` + `display=swap`，首屏不阻塞。

⚠️ **离线演示风险**：字体走 Google Fonts CDN。若黑客松现场网络不通，
中文会回退到系统字体，印章字失效。建议赛前把 5 款字体自托管到 `public/fonts/`。

---

## 六、现有素材清单（`app/public/`，101 个）

| 类别 | 数量 | 命名规范 | 示例 |
|---|---|---|---|
| 影从立绘 | 8 | `echo-{id}.png` | `echo-baize.png` |
| 四大陆 | 4 | `continent-{suit}.png` | `continent-spade.png` |
| 位阶玉玺 | 5 | `tier-{id}.svg` | `tier-tian.svg`、`tier-honghuang.svg` |
| 生肖印 | 12 | `zodiac-{01..12}.svg` | `zodiac-01.svg` |
| 花色图标 | 4 | `suit-{name}.svg` | `suit-club.svg` |
| 卡面画 | 12 | `card-art-{name}.png` | `card-art-blade.png` |
| 背景 | 6 | `bg-{scene}.png` | `bg-village-night.png` |
| 敌人 | 8 | `enemy-{name}.png` | `enemy-shanxiao.png` |
| 精英/Boss | 6 | `elite-`/`boss-{name}.png` | `boss-taowu.png` |
| 狼人杀角色 | 4 | `role-{name}.png` | `role-werewolf.png` |
| 事件插画 | 4 | `event-{name}.png` | `event-altar.png` |
| 民众头像 | 8 | `pop-{name}.png` | `pop-qianmian.png` |
| 材质 | 2 | `texture-{name}.png` | `texture-noise.png` |

### 命名规则（新素材必须遵守）

```
{类别}-{标识}.{png|svg}
```

- 图标、印章、几何图形 → **SVG**（可缩放，体积小）
- 立绘、背景、插画 → **PNG**（需透明通道或复杂渲染）
- 一律小写 + 连字符，**不用下划线、不用中文文件名**（部署路径安全）

---

## 七、待补素材（黑客松优先级）

| 优先级 | 素材 | 数量 | 用途 |
|---|---|---|---|
| P0 | 裁判席位徽记 | 3 | 裁判团机制演示（J0 算法 / J1 AI / J2 Agent） |
| P0 | 判例卡卡面 | 1 | `judicial` 稀有度唯一卡，需明显区别于残章卡 |
| P1 | 观战页边框/幕布 | 2 | 观战演出的舞台感 |
| P1 | 海盗分金场景图 | 1 | 若新增该游戏（♦ 金壤） |
| P2 | 异能图标 | 8→48 | 现有 8 影从异能，扩充后需配图 |
| P2 | 天梯榜单装饰 | 2 | 前三名的金银铜印章 |

---

## 八、交给 Codex 做视觉优化时的约束

本地已装 `codex` CLI（`codex exec` 可非交互调用）。派活时**必须**把以下约束写进 prompt：

```
硬约束（不可违反）：
1. 暗色唯一，不引入亮色模式，不改 body 背景的星云+噪点两层
2. 四花色语义色固定：♠#8B93F8 ♥#EE6A72 ♣#4ECB9C ♦#F2A93B
3. 所有新色值必须用 CSS 变量，定义在 :root，不写死在组件里
4. 动效必须能被 prefers-reduced-motion 覆盖
5. 不新增第三方 UI 库（已有 shadcn/ui + Radix，够用）
6. 中文文案不用英文占位，直接写中文
7. 改完必须 pnpm check 通过（tsc -b 0 错误）
```

### 推荐的派活粒度

**一次一个页面或一个组件**，不要"优化整个 UI"。理由：
Codex 的改动难以评审，大范围改动会破坏已有的视觉一致性。

示例：

```bash
codex exec "读 DESIGN.md 的硬约束。优化 app/src/pages/Leaderboard.tsx 的
天梯榜单视觉：前三名加印章装饰，身份盲盒（不标注 AI/人类）要有悬念感。
只改这一个文件，改完跑 pnpm check 确认 0 错误。"
```

---

## 九、页面清单与视觉状态

| 路由 | 页面 | 行数 | 视觉完成度 |
|---|---|---|---|
| `/` | 首页（叙事页，无 TopHUD） | 146 | ✅ |
| `/lobby` | 大厅 | 111 | ✅ |
| `/game/werewolf/:id` | 狼人杀牌桌 | 1146 | ✅ 最完整 |
| `/game/guess/:id` | 猜平均数牌桌 | 749 | ✅ |
| `/game/poker` | 丹丘牌楼 | 631 | ✅ |
| `/game/spire/combat` | 碎境战斗 | 603 | ✅ |
| `/game/online-poll/:code` | 红眼病联机 | 531 | ✅ |
| `/game/online/:code` | 猜数联机 | 512 | ✅ |
| `/codex` | 规则图鉴 | 311 | ✅ |
| `/agent-portal` | Agent 接入门户 | 275 | ✅ |
| `/leaderboard` | 天梯 | 260 | ✅ |
| `/lore` | 十日残章 | 252 | ✅ |
| `/world` | 世界地图 | 102 | ⚠️ 偏薄 |
| `/agent` | 影从档案 | 127 | ⚠️ 偏薄 |
| — | **观战页** | — | ❌ 缺失（P1） |
| — | **裁判席页** | — | ❌ 缺失（P0） |

`/world` 和 `/agent` 只有 100 多行，相比其他页面明显偏薄，是视觉优化的首选目标。
