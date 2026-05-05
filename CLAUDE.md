# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

BewlyCat 是一个浏览器扩展，用于增强 B 站 (bilibili.com) 网页端体验。基于 [BewlyBewly](https://github.com/BewlyBewly/BewlyBewly) Fork 后独立开发，使用 Vue 3 + TypeScript + Vite，模板源自 vitesse-webext。支持 Chrome / Edge / Firefox / Safari，但 Safari 仅提供构建命令，不做主动适配。

## 常用命令

包管理器固定为 `pnpm`（`packageManager` 字段已锁定版本）。

```bash
# 开发（Chrome/Edge）
pnpm dev                # 启动 vite + tsup watch + 注入脚本三个并行任务
pnpm start:chromium     # 启动 web-ext 自动加载 extension/ 目录

# 开发（Firefox）
pnpm dev-firefox
pnpm start:firefox

# 构建产物（输出到 extension/、extension-firefox/、extension-safari/）
pnpm build
pnpm build-firefox
pnpm build-safari

# 打包发布
pnpm pack:zip           # extension.zip
pnpm pack:zip-firefox   # extension-firefox.zip
pnpm build-pack         # 一键产出 Chrome 和 Firefox 的全部 zip

# 质量检查
pnpm lint               # ESLint（@antfu/eslint-config）
pnpm lint:fix
pnpm typecheck          # vue-tsc，无 emit 类型检查
pnpm test               # vitest（jsdom 环境）
pnpm test src/tests/uriParse.spec.ts   # 跑单个测试文件
pnpm knip               # 检查未使用的导出/依赖
```

提交时 `simple-git-hooks` 会触发 `lint-staged`，对所有暂存文件执行 `eslint --fix`。

## 构建管线

扩展由**三条独立的构建管线**并行产出，不要混淆：

1. **`vite.config.ts`** — 构建 `popup/` 和 `options/` 两个 HTML 页面（开发期通过 `pnpm dev:web` 起 vite dev server，端口 3303）。
2. **`vite.config.content.ts`** — 把 `src/contentScripts/index.ts` 打包为 IIFE 格式的 `dist/contentScripts/index.global.js`，CSS 合并为单文件 `style.css`（`cssCodeSplit: false`）。UnoCSS 只在这条管线启用。
3. **`vite.config.inject.ts`** — 打包注入到页面 MAIN world 的脚本（`dist/contentScripts/inject.global.js`），用于访问页面 JS 上下文（B 站播放器对象等）。
4. **`tsup.config.ts`** — 打包 background（Chrome MV3 service worker / Firefox & Safari 持久化脚本）。`md5` 走 `noExternal` 内联。

构建目标目录由 `scripts/utils.ts` 中的 `isFirefox` / `isSafari` 环境变量决定，三条管线共享同一套判断。`src/manifest.ts` 在 `scripts/prepare.ts` 中根据同样的环境变量动态生成 `manifest.json`：MV3 的 `service_worker` 仅在 Chromium 使用，Firefox/Safari 退回到 `scripts` 形式；Firefox 额外引入 `webRequest`/`webRequestBlocking`/`cookies` 权限以处理跨域 Origin/Referer。

> Chrome Web Store 的「代码可读性」策略禁止 mangling，因此 `terserOptions.mangle = false`。修改混淆配置前请确认上架要求。

## 架构要点

### 入口与内容脚本

- `src/contentScripts/index.ts` 是核心入口。文件顶部用大量正则定义了 `isSupportedPages()`，**新增页面必须在此处加正则**，否则 Vue 应用不会挂载。
- 主应用渲染在 **Shadow DOM** 内做样式隔离（见 `src/contentScripts/views/App.vue`）。这意味着普通的 `document.querySelector` 拿不到组件内元素，调试时要从 shadow root 进入。
- `src/inject/index.ts` 在 `world: 'MAIN'` 注入页面上下文，用于读写 B 站全局变量（如播放器实例）。content script 与 inject script 之间通过 `window.postMessage` 或自定义事件通信。
- `src/background/` 处理 API 转发（`messageListeners/api/`）、Tab 管理（`messageListeners/tabs.ts`）、WBI 鉴权（`wbiSign.ts`）、应用授权调度（`appAuthScheduler.ts`）。content script 不直接调 B 站 API，统一走 background 转发以规避 CORS 与拿到 cookies。

### 状态与设置

- Pinia stores 集中在 `src/stores/`：`settingsStore` / `mainStore` / `topBarStore` / `forYouStore`。
- `src/logic/storage.ts` 是**设置的真源**，通过 `webextension-polyfill` 的 `browser.storage` 持久化。`settings` 与 `localSettings` 分别对应同步与本地两类。修改设置项时同时维护：
  - `src/logic/storage.ts`（默认值与类型）
  - `src/components/Settings/`（UI）
  - `src/_locales/`（每种语言的 i18n 文案）

### 组件与视图

- `src/components/` 公用组件，`src/contentScripts/views/` 按 B 站页面组织（Home、Anime、History、Search、SearchResults、Moments、Favorites、WatchLater）。
- 重要功能模块：`TopBar/`、`Dock/`、`VideoCard/`、`Settings/`。
- 工具函数在 `src/utils/`，关注：`shortcuts.ts`（快捷键）、`player.ts`（播放器增强：默认模式、自动滚动、自动退出全屏）、`audioNormalization.ts` + `volumeNormalizationControl.ts`（音量均衡）、`tabs.ts`（后台打开链接）、`localWallpaper.ts` + `wallpaperCache.ts`（壁纸）。

### 自动导入

`vite.config.ts` 配置了 `unplugin-auto-import`，**Vue API 与 `browser`（webextension-polyfill）无需 import**。新文件直接用 `ref` / `computed` / `browser.storage` 即可，类型由 `src/auto-imports.d.ts` 提供。

### 国际化

- 文案在 `src/_locales/`，由 `@intlify/unplugin-vue-i18n` 在构建期编译。
- **i18n 文件必须手工维护**——`docs/CONTRIBUTING.md` 明确禁止使用 `i18n Ally` 等扩展自动管理，否则会破坏键的位置和注释。新增文案需手动同步所有语言文件。

## 提交规范

`docs/CONTRIBUTING.md` 沿用 Angular 风格：`feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore` / `perf` / `ci`。鼓励加 scope 与正文，例如 `fix(dock): xxx`。最近的提交多为中文描述，遵循该风格即可。

## 已知约束

- **不打包 Safari**：作者声明不主动维护 Safari 适配，构建命令仅为方便自助打包，不要为 Safari 引入大量条件分支。
- **不做客户端封装**：README 顶部强调本扩展只用于优化 B 站官网，禁止打包成独立客户端。
- B 站 API 文档参考 `socialsisteryi/bilibili-api-collect`（context7 有索引），新增 API 时按该仓库的字段命名。
