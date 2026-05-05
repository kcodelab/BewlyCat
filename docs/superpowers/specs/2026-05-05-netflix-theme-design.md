# Netflix 主题包设计文档

日期：2026-05-05
状态：设计中（待用户最终批准 §2-§7 后定稿）

## 目标

为 BewlyCat 引入「Netflix 主题包」，整体复刻 Netflix 视觉与首页交互（hero + 横向 row + 卡片悬停浮层 + TOP 10），同时**不影响现有任何功能**：未启用 Netflix 主题的用户走的代码路径必须保持当前行为。

## 范围

| 模块 | 处理方式 |
|---|---|
| **Home 视图** | **完整 Netflix layout 重做**：hero + 横向 row（8 个 SubPage row 化 + 继续观看 row + TOP 10 row） |
| 顶栏 | 沿用现有结构（BewlyCat/BiliBili 切换 + tab 区 + 搜索 + 用户区），**仅配色和字体** Netflix 化；不引入文字导航+下划线 |
| 其他所有页面（Anime / Search / Favorites / History / WatchLater / Moments 等） | **仅配色** Netflix 化（黑底 + 红色 + 字体），布局完全不动 |
| 「我的列表」独立页 | 不做 |
| 卡片悬停浮层中的「+ 我的列表」按钮 | 等价于「加入稍后再看」（复用现有 API） |

非目标：

- 不为「动画 / 科技 / 游戏」等没有现成 BewlyCat 视图的分区页新建独立页面
- 不引入新的本地 watchlist 数据层
- 不做移动端响应式优化（Netflix 是定宽设计；保持 BewlyCat 现有响应式策略）
- 不做主题包热加载/插件市场（YAGNI）

## 架构

### 总览

```
themePack='netflix' 启用时：
  ① 注入 Netflix CSS 变量层（黑底 / 主红 / 字体）
     → 主文档 + Shadow DOM 双侧覆盖现有 --bew-* 变量
     → 自动作用于所有页面

  ② Home.vue 变薄壳，按 themePack 选布局：
     - <HomeClassic>（现状的 Tab + SubPage）
     - <HomeNetflix>（hero + 横向 row）

  ③ VideoCard 增加 variant prop：
     - 'grid'（默认，现状不变）
     - 'netflix-row'（16:9 横版 + 悬停浮层）

  ④ Netflix 主题包内部锁定 theme='dark'，避免「浅色 + Netflix」视觉怪胎；
     切换时暂存用户原 theme，切回 default 时还原。
```

### 关键设计原则

1. **数据层与布局解耦**：把 SubPage 组件里的数据获取抽到 composables，两种布局共享数据缓存
2. **Netflix 代码隔离在 `netflix/` 子目录**：非 Netflix 模块不直接 import 任何 `*Netflix*` 组件
3. **懒加载**：Netflix 视图通过 `defineAsyncComponent` 加载，default 用户 bundle 体积零增加
4. **零回归**：VideoCard `variant` prop 默认 `'grid'`，所有现有调用点不需要改；SubPage 组件对外 props/emits 不变

### 文件结构

```
src/
├── logic/
│   └── storage.ts                                # 新增 themePack 字段
├── composables/
│   ├── useDark.ts                                # 增加 themePack 锁定 theme=dark 的逻辑
│   └── useThemePack.ts                           # ★ 新增，主题包注入与切换
├── components/
│   └── VideoCard/
│       └── VideoCard.vue                         # 增加 variant prop
└── contentScripts/views/Home/
    ├── Home.vue                                  # 薄壳，按 themePack 选布局
    ├── HomeClassic.vue                           # ★ 把现在 Home.vue 的 tab + SubPage 逻辑搬过来
    ├── composables/                              # ★ 新增数据层
    │   ├── useForYouData.ts
    │   ├── useTrendingData.ts
    │   ├── useRankingData.ts
    │   ├── useHistoryData.ts                     # 继续观看 row 用
    │   ├── useFollowingData.ts
    │   ├── useSubscribedSeriesData.ts
    │   ├── useWeeklyData.ts
    │   ├── useLiveData.ts
    │   └── usePreciousData.ts
    ├── components/                               # 现有 SubPage 组件，改造为消费 composable
    │   ├── ForYou.vue
    │   ├── Trending.vue
    │   └── ...
    └── netflix/                                  # ★ 新建，Netflix 专属
        ├── HomeNetflix.vue                       # 组装 hero + N 个 row
        ├── HeroBanner.vue                        # 全屏 hero + 渐变遮罩 + 轮播
        ├── HorizontalRow.vue                     # 通用横向 row（左右箭头、惯性滚动）
        ├── ContinueWatchingRow.vue               # 横向 row 的继续观看变体（卡片底部进度条）
        ├── Top10Row.vue                          # 横向 row 的 TOP 10 变体（巨大数字背景）
        └── VideoCardHover.vue                    # 悬停浮层（播放/+稍后/赞/详情）

> 16:9 横版卡片本身由 `VideoCard.vue` 通过 `variant='netflix-row'` 渲染，不新增独立卡片组件。
> Netflix 子目录里的所有 row 组件都消费这一个 VideoCard。
```

## Home 内容组装

Netflix Home 默认显示以下 row（顺序从上到下）：

| Row | 数据源 | 组件 |
|---|---|---|
| Hero（全屏） | Trending 第一条（带高质量封面），未来可换 | HeroBanner.vue |
| 继续观看 | 历史记录 API（已在 background 中存在）| ContinueWatchingRow.vue |
| 热门推荐 | `useForYouData` | HorizontalRow.vue |
| 今日趋势 | `useTrendingData` | HorizontalRow.vue |
| TOP 10 今日热播 | `useRankingData` 取前 10 | Top10Row.vue |
| 关注 | `useFollowingData` | HorizontalRow.vue |
| 订阅系列 | `useSubscribedSeriesData` | HorizontalRow.vue |
| 每周必看 | `useWeeklyData` | HorizontalRow.vue |
| 入站必刷 | `usePreciousData` | HorizontalRow.vue |
| 直播 | `useLiveData` | HorizontalRow.vue |

复用现有 `settings.homePageTabVisibilityList` 的可见性 + 顺序配置：用户在设置里勾掉哪个 SubPage、对应 row 就不出现。「继续观看」「TOP 10」「Hero」是 Netflix 模式下额外固定显示的，不进入该列表。

### Hero 数据源策略

第一版从 Trending 列表里挑第一条「图分≥某阈值」的视频，规避 Trending 头条但封面文字过多的情况。Trending 接口失败时回退到 ForYou 第一条。两个都失败则跳过 Hero、直接展示第一个 row（不阻塞首屏）。

## 卡片悬停浮层

参考 Netflix 但简化：

- 悬停 ~500ms 后（沿用现有 `hoverVideoCardDelayed` 设置）卡片放大 1.3x
- 浮层显示：大播放键、+稍后再看、点赞、详情按钮、标题、UP 主、时长、简介摘要（如有）
- **不实现"推开邻居"动画**：用 CSS `transform-origin` + 父容器 `overflow: visible` 让浮层自然遮挡相邻卡片，工程量大头降下来；视觉上接近 Netflix
- 离开 ~200ms 后浮层消失
- 现有 `VideoCard` 的视频小窗口预览功能在 `variant='netflix-row'` 时**关闭**（避免双重浮层冲突）

## TOP 10 巨大数字

每张卡片左侧叠一个超大数字（1-10），半透明描边样式（参考 Netflix）：

- 数字使用 SVG（不依赖系统字体）
- 与卡片用 CSS Grid 重叠布局，数字 z-index 低于卡片图但高于背景
- 数字字号 ~clamp(120px, 18vw, 240px)，自适应屏宽

## 设置 UX

设置面板新增「主题包」section（在 Appearance 设置里，紧挨现有「主题」「主题色」配置）：

- 单选：Default（默认）/ Netflix
- 选 Netflix 时：显示一句说明「Netflix 主题包会自动启用暗色模式 + 红色主色，并将首页改为 Netflix 风格 row 布局。其他页面仅改变配色」
- 切换瞬间：通过 view-transition API 做径向过渡（沿用 `useDark.toggleDark` 已有的实现思路）
- 保留「Wallpaper」设置但 Netflix 模式下**强制不显示壁纸**（hero 占据首屏，壁纸会与之冲突）；切回 default 时壁纸自动恢复

## 错误与降级

| 故障 | 行为 |
|---|---|
| Hero 数据源（Trending + ForYou）都挂 | 跳过 Hero，直接显示第一个 row |
| 某个 row 数据获取失败 | 该 row 显示「加载失败，点击重试」占位条；不阻塞其他 row |
| 历史记录 API 不可用（未登录） | 隐藏「继续观看」row |
| 用户登录态失效 | 同 default 主题表现，TopBar 显示登录入口 |
| themePack 配置损坏（storage 读到非法值） | 回退 'default' 并打 warning |

## 测试策略

- **单元测试**（vitest）：
  - 数据 composables 的成功 / 失败路径
  - VideoCard `variant` prop 切换不破坏现有 grid 渲染快照
  - themePack 切换时 theme 锁定与还原逻辑
- **手测清单**（在两份独立的 BewlyCat 安装上分别跑）：
  - default 主题：Home / Anime / Search / Favorites / History / WatchLater / Moments / 视频详情页 行为与 main 分支完全一致（视觉对照）
  - Netflix 主题：上面所有页面的 Netflix 配色生效 + Home 显示 Hero + N 个 row + 悬停浮层 + TOP 10 数字
  - 切换主题：default ↔ Netflix 反复切 5 次，settings/localStorage 状态正确恢复
  - 未登录态、网络错误、API 限流 各自的降级行为
- **回归基线**：在合入主题包之前先跑一遍 `pnpm test && pnpm typecheck && pnpm lint`，主题包合入后再次跑通

## 实施里程碑

按依赖顺序实现，每阶段产出一个可独立验收的产物：

1. **基础设施**（~3 天）
   - `themePack` 字段 + storage 迁移
   - CSS 变量覆盖层 + Netflix 调色板
   - 设置面板入口
   - 验收：在所有现有页面切换 themePack 能看到配色变化，行为不变

2. **Home 数据层重构**（~3 天）
   - 抽 8 个 SubPage 的数据 composable
   - 改造 SubPage 组件消费 composable
   - 把现 Home.vue 的 tab + SubPage 逻辑搬到 HomeClassic.vue，Home.vue 变薄壳
   - 验收：default 模式 Home 行为完全等价，跑通现有测试

3. **Netflix Home 骨架**（~4 天）
   - HomeNetflix.vue + HorizontalRow.vue + VideoCardNetflix.vue（无悬停浮层）
   - 接通所有 row 的数据
   - 验收：Netflix 模式下 Home 能渲染 N 个 row，可滚动

4. **Hero + TOP 10 + 继续观看**（~3 天）
   - HeroBanner.vue（含轮播 + 渐变 + 静音按钮）
   - Top10Row.vue（巨大数字）
   - ContinueWatchingRow.vue（进度条）
   - 验收：首屏视觉接近 mockup

5. **悬停浮层 + 角标**（~3 天）
   - VideoCardHover.vue（播放/加入稍后/赞/详情）
   - NEW 角标、N 角标
   - 进度条
   - 验收：交互细节完成

6. **Polish + 测试 + 文档**（~2 天）
   - 边角 case、错误降级
   - 测试用例
   - CHANGELOG / README 更新

**总计 ~18 个工作日**，约 3.5 周。

## 风险

| 风险 | 缓解 |
|---|---|
| 数据层抽离破坏现有 SubPage 行为 | 每个 SubPage 改造后立即跑现有 e2e 手测；不通过不下一步 |
| 卡片浮层在 Shadow DOM 内 z-index 冲突 | 浮层 portal 到 Home 容器顶层 |
| TOP 10 巨大数字在低 DPI 屏幕上糊 | SVG 实现 + 描边样式，矢量无损 |
| Hero 自动播放预览（如果做）拖慢首屏 | 第一版只用静态图，预览功能延后 |
| Trending 接口偶发返回封面差的视频 | Hero 选第一个图分 ≥ 阈值的；都不行就降级 |
| 主题切换时 view-transition 在 Shadow DOM 内表现异常 | 沿用 `useDark.toggleDark` 已验证的 shadow-dom 兼容方案 |

## 设计决议（待用户在 PR 阶段重审）

以下决议基于现有信息做的工程取舍，文档定稿后视为已批准；如要改动请在用户批准前指出：

1. `settings.themePack: 'default' | 'netflix'`
2. Netflix 模式锁 `theme='dark'`，切换时暂存原 theme，切回 default 时还原
3. Hero 数据源：Trending 头条 + 封面图分阈值过滤；Trending 失败回退 ForYou；都失败则跳过 Hero
4. 卡片悬停浮层不实现「推开邻居」，靠 `transform-origin` + `overflow: visible` 自然遮挡
5. 「+ 我的列表」按钮直接复用现有「加入稍后再看」按钮的图标与 i18n 文案，不新增 i18n 键
6. Row 顺序：以 `settings.homePageTabVisibilityList` 当前顺序为准，**Hero 固定在最顶，「继续观看」紧随其后，「TOP 10」固定插在所有 SubPage row 之前**
7. Netflix 模式强制隐藏壁纸；切回 default 时壁纸自动恢复
