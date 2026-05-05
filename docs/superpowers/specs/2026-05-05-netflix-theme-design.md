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

  ④ Netflix 主题包内部引入「effective appearance override」：
     - 不改写用户持久化的 `settings.theme`
     - 当 `themePack='netflix'` 时，运行时外观强制按 dark 解析
     - 切回 default 时仅移除 override，用户原 theme 偏好天然生效
     - `useDark.toggleDark` 在 Netflix 模式下短路：不再写 `settings.value.theme`
     - 所有调用 `useDark.toggleDark` 的可见入口都必须表现一致：Settings / Dock / SideBar 等入口在 Netflix 模式下显示但禁用，或给出统一的 locked 提示；不允许出现“还能点但无效果”的 no-op 按钮

  ⑤ Netflix 主题包内部引入「effective wallpaper suppression」：
     - 不改写 `settings.wallpaper` / `settings.searchPageWallpaper`
     - 仅在运行时屏蔽对壁纸的读取与渲染
     - 切回 default 时壁纸配置天然恢复
     - 必须覆盖至少 4 个真实消费点：`AppBackground.vue`（壁纸主消费者）、`useTopBarInteraction`（顶栏透明度判断）、Home 搜索页模式背景（`Home.vue` 内 `settings.searchPageWallpaper` 的直读路径）、Search 页 `searchPageWallpaper`

  ⑥ Netflix 主题包内部引入「effective theme color override」：
     - 不改写 `settings.themeColor` / `darkModeBaseColor` / `useLinearGradientThemeColorBackground` / `searchPageLogoColor`
     - 运行时强制：themeColor → `#E50914`、darkModeBaseColor → `#141414`、useLinearGradientThemeColorBackground → `false`、searchPageLogoColor → `'themeColor'`（此时 effective themeColor 已是 Netflix 红）
     - 现有所有 `--bew-theme-color` / `--bew-dark-base-color` 等 CSS 变量都从 effective 值派生
     - 切回 default 时用户原配色完整恢复
     - Appearance 设置里对应控件保持可见但禁用，并提示"由 Netflix 主题包锁定"，避免用户修改后无即时效果
```

### 关键设计原则

1. **数据层与布局解耦**：把 SubPage 组件里的数据获取抽到 composables，两种布局共享数据缓存
2. **Netflix 代码隔离在 `netflix/` 子目录**：非 Netflix 模块不直接 import 任何 `*Netflix*` 组件
3. **懒加载**：Netflix 视图通过 `defineAsyncComponent` 加载，default 用户 bundle 体积尽量接近零增量；若 `VideoCard` 因新增 `variant` 带来少量共享代码增加，视为可接受
4. **零回归**：VideoCard `variant` prop 默认 `'grid'`，所有现有调用点不需要改；SubPage 组件对外 props/emits 不变
5. **区分“用户设置”与“运行时生效值”**：`theme`、wallpaper 等现有设置保留用户原意，Netflix 主题只通过 derived/effective 层覆盖最终表现

### 文件结构

```
src/
├── logic/
│   └── storage.ts                                # 新增 themePack 字段
├── composables/
│   ├── useDark.ts                                # 读取 effective theme，而不是直接改写 settings.theme
│   └── useThemePack.ts                           # ★ 新增，主题包注入、effective theme / wallpaper 解析
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
| TOP 10 今日热播 | `useRankingData` 取前 10 | Top10Row.vue |
| 热门推荐 | `useForYouData` | HorizontalRow.vue |
| 今日趋势 | `useTrendingData` | HorizontalRow.vue |
| 关注 | `useFollowingData` | HorizontalRow.vue |
| 订阅系列 | `useSubscribedSeriesData` | HorizontalRow.vue |
| 每周必看 | `useWeeklyData` | HorizontalRow.vue |
| 入站必刷 | `usePreciousData` | HorizontalRow.vue |
| 直播 | `useLiveData` | HorizontalRow.vue |

固定顺序规则：

- `Hero` 永远在最顶
- `继续观看` 永远紧随 `Hero`
- `TOP 10` 永远在所有 SubPage row 之前
- 其余 SubPage row 复用现有 `settings.homePageTabVisibilityList` 的可见性 + 顺序配置：用户在设置里勾掉哪个 SubPage、对应 row 就不出现

`Hero` / `继续观看` / `TOP 10` 都不进入 `homePageTabVisibilityList`。

### Hero 数据源策略

第一版从 Trending 列表里挑第一条「图分≥某阈值」的视频，规避 Trending 头条但封面文字过多的情况。Trending 接口失败时回退到 ForYou 第一条。两个都失败则跳过 Hero、直接展示第一个 row（不阻塞首屏）。

若实现 Hero carousel，则第一版规则固定如下：

- 最多 3 张 slide
- 先扫描 Trending，按原有顺序取出 `coverScore >= 60` 的候选
- 若 Trending 不足 3 张，再按原有顺序从 ForYou 补齐同样满足 `coverScore >= 60` 的候选
- 若某数据源缺少 `coverScore` 字段，则该条只允许在“整个列表都没有分数可用”时参与候选，避免无分数条目压过已评分条目
- 若最终只有 1 张有效候选，则降级为单张静态 Hero，不启用轮播控件
- 若最终有 2-3 张有效候选，则启用轮播；不足 3 张时不重复补位、不造假数据
- Trending 与 ForYou 去重按视频唯一 id 处理，避免同一视频重复出现在多张 slide

## 卡片悬停浮层

参考 Netflix 但简化：

- 悬停延迟沿用现有 `hoverVideoCardDelayed` 语义：
  - `false` 时约 500ms 后展开
  - `true` 时约 1200ms 后展开
  - 如需改成 Netflix 专属时序，后续单列新设置，不复用该开关语义
- 浮层显示：大播放键、+稍后再看、点赞、详情按钮、标题、UP 主、时长、简介摘要（如有）
- **不实现"推开邻居"动画**：用 CSS `transform-origin` + 父容器 `overflow: visible` 让浮层自然遮挡相邻卡片，工程量大头降下来；视觉上接近 Netflix
- 离开后约 100ms 隐藏（与现有 `VideoCard` 防抖语义保持一致）
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

实现约束：

- 仅隐藏设置项或禁用输入控件是不够的，必须在运行时渲染分支中统一屏蔽壁纸读取
- 至少覆盖四个入口：`AppBackground.vue`、Home 搜索页模式背景、TopBar 对“当前是否有壁纸”的判断逻辑、Search 页 wallpaper 渲染
- 不清空用户原壁纸 URL / 本地壁纸引用，避免切回 default 时丢状态
- `theme` / `themeColor` / `darkModeBaseColor` / `useLinearGradientThemeColorBackground` 相关控件在 Netflix 模式下统一禁用，并展示锁定提示；用户保存值不改写

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
  - themePack 切换时 effective theme override / wallpaper suppression 逻辑
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
   - effective theme / wallpaper 解析层
   - 设置面板入口
   - 验收：在所有现有页面切换 themePack 能看到配色变化，行为不变

2. **Home 数据层重构**（~3 天）
   - 抽 8 个 SubPage 的数据 composable
   - 改造 SubPage 组件消费 composable
   - 把现 Home.vue 的 tab + SubPage 逻辑搬到 HomeClassic.vue，Home.vue 变薄壳
   - 验收：default 模式 Home 行为完全等价，跑通现有测试

3. **Netflix Home 骨架**（~4 天）
   - HomeNetflix.vue + HorizontalRow.vue + `VideoCard.vue variant='netflix-row'`（无悬停浮层）
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
| 数据层抽离破坏现有 SubPage 行为 | 每个 SubPage 改造前先列对外接口快照（props / emits / expose / provide），改造后逐项核对；不通过不下一步 |
| `Home.vue` 449 行的搬迁丢失逻辑（虚拟滚动 / 滚动隐藏 / Provide / scroll restore） | Task 3 必须先输出 Home.vue 的 ref/provide/事件/scroll 状态清单，HomeClassic 逐项等价后才允许 commit |
| 卡片浮层被 `overflow-x: auto` 裁切 | 用 Vue `<Teleport>` 把浮层送到 Home 顶层；Shadow DOM 内 teleport target 显式指定 |
| TOP 10 巨大数字在低 DPI 屏幕上糊 | SVG 实现 + 描边样式，矢量无损 |
| Hero 自动播放预览（如果做）拖慢首屏 | 第一版只用静态图，预览功能延后 |
| Trending 接口偶发返回封面差的视频 | Hero 选第一个图分 ≥ 60 的；都不行就降级到 ForYou 头条；再不行跳过 Hero |
| themePack 改写持久化设置导致用户偏好丢失 | 决议 #2 / #7 / #8：所有派生项走 effective override，不改写 `settings.*` |
| 仅在设置 UI 隐藏 Wallpaper 但运行时仍继续渲染 | 决议 #7：覆盖 4 个真实消费点（AppBackground / Home 搜索页模式 / TopBar / Search） |
| Netflix 模式下颜色与渐变控件仍可编辑，造成“能改但不生效” | 对被主题包接管的 Appearance 控件统一禁用并加锁定提示 |
| `useDark.toggleDark` 直接写 `settings.theme` 与"不改写"原则冲突 | 决议 #2：toggleDark 在 Netflix 模式下短路，仅触发 view-transition |
| 数据 composable 在 Classic / Netflix 切换时重复请求或内存泄漏 | 决议 #9：状态提到模块作用域，单例化 |
| 首次切到 Netflix 时 defineAsyncComponent 加载延迟与 view-transition 重叠出现白屏 | 决议 #10：配 loadingComponent + delay:0 |
| 主题切换时 view-transition 在 Shadow DOM 内表现异常 | 沿用 `useDark.toggleDark` 已验证的 shadow-dom 兼容方案；Firefox 上做兼容性测试矩阵 |
| Firefox / ManifestV2 在 view-transition 上行为差异 | 实施期在 Firefox + Chromium 双端跑手测清单；不通过则降级为 fade transition |
| VideoCard 在视频播放页右侧推荐里也被复用 | variant 默认 `grid`，Task 6 验收必须显式列"播放页右侧推荐 VideoCard 视觉与行为不变" |

## 设计决议

以下决议基于现有信息做的工程取舍，文档定稿后视为已批准；如要改动请在用户批准前指出：

1. `settings.themePack: 'default' | 'netflix'`
2. Netflix 模式不改写 `settings.theme`；通过 effective theme override 强制按 dark 渲染。`useDark.toggleDark` 在该模式下短路（不写 `settings.value.theme`，仅触发 view-transition 给主题包切换复用）；设置面板的明暗切换器禁用并 hover 提示"由 Netflix 主题包锁定"
3. Hero 数据源：Trending 头条 + 封面图分阈值过滤（阈值 60，可调）；Trending 失败回退 ForYou；都失败则跳过 Hero
4. 卡片悬停浮层不实现「推开邻居」；浮层用 Vue `<Teleport>` 送到 Home 容器顶层，规避 `HorizontalRow` 的 `overflow-x: auto` 裁切（CSS 规范下 `overflow-x: auto` 会强制 `overflow-y` 也为 auto）
5. 「+ 我的列表」按钮直接复用现有「加入稍后再看」按钮的图标与 i18n 文案，不新增 i18n 键
6. Row 顺序：以 `settings.homePageTabVisibilityList` 当前顺序为准，**Hero 固定在最顶，「继续观看」紧随其后，「TOP 10」固定插在所有 SubPage row 之前**
7. Netflix 模式抑制壁纸；effective wallpaper suppression 必须覆盖至少 4 个消费点：`AppBackground.vue`（壁纸主消费者）、`useTopBarInteraction`（顶栏透明度判断）、Home 搜索页模式背景（`Home.vue` 内 `settings.searchPageWallpaper` 的直读路径）、Search 页面的 `searchPageWallpaper` 渲染入口；切回 default 时壁纸自动恢复
8. **主色相关字段（`themeColor` / `darkModeBaseColor` / `useLinearGradientThemeColorBackground` / `searchPageLogoColor`）全部走 effective override**，不改写持久化设置；Netflix 模式锁定 themeColor=`#E50914`、darkModeBaseColor=`#141414`、useLinearGradientThemeColorBackground=`false`、searchPageLogoColor=`'themeColor'`；现有所有 `--bew-theme-color` / `--bew-dark-base-color` CSS 变量从 effective 值派生
   对应 Appearance 控件保持可见但禁用，并展示"由 Netflix 主题包锁定"提示，避免用户误以为修改即时生效
9. **共享数据缓存**：所有 Home 数据 composable 状态提到模块作用域（或用 VueUse 的 `createSharedComposable`），保证 HomeClassic 与 HomeNetflix 共享同一份 reactive state，避免重复请求和内存泄漏
10. **Netflix 视图懒加载必须配 `loadingComponent`** + `delay: 0`：首次切换会触发 view-transition，缺 loadingComponent 会出现可观察白屏夹在过渡动画里
