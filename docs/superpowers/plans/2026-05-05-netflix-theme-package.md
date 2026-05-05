# Netflix Theme Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `netflix` theme pack to BewlyCat that changes global styling, swaps Home to a Netflix-style row layout, and preserves default-mode behavior for users who do not enable it.

**Architecture:** Keep the existing settings model as the source of user intent, then derive runtime-only `effective` values for appearance, theme color, base color, gradient flag, search-page logo color, and wallpaper suppression when `themePack='netflix'`. Split Home into a thin shell plus `HomeClassic` and `HomeNetflix`, and reuse a single `VideoCard.vue` with a new `variant='netflix-row'` path instead of introducing a separate Netflix card component.

**Tech Stack:** Vue 3, Pinia, VueUse, Vitest, Vue Test Utils, TypeScript, UnoCSS

**Spec reference:** `docs/superpowers/specs/2026-05-05-netflix-theme-design.md`

---

## Task 0: Preflight

**Files:** none

- [ ] Confirm baseline commands run clean on `main` before any work:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all PASS. If any fails, STOP and report; do not start Task 1 on a broken baseline.

- [ ] Confirm `package.json` exposes the script names this plan relies on (`lint`, `typecheck`, `test`, `dev`, `build`). If renamed, update plan references before continuing.

- [ ] Snapshot the entry points this plan must not regress:
  - `src/contentScripts/views/Home/Home.vue` — record line count, list its `provide()` keys, expose-d refs, watched emitter events, scroll-related state names.
  - `src/components/VideoCard/VideoCard.vue` — record every preview-gating computed/condition (search for `showPreview`, `enableVideoPreview`, `previewVideoUrl`, `onlyCoverVideoPreview`, `hoverVideoCardDelayed`).
  - `src/components/AppBackground.vue` — record every `settings.value.wallpaper` / `settings.value.searchPageWallpaper` read site.
  - `src/composables/useDark.ts` — record every `settings.value.theme` write site (`toggleDark` is the known one; verify there are no others).

Output of this snapshot lives in PR description, not in code.

---

## File Structure

- Modify: `src/logic/storage.ts`
  Responsibility: add `themePack` storage field and defaults.
- Create: `src/composables/useThemePack.ts`
  Responsibility: expose runtime-only derived theme-pack state (`isNetflixThemePack`, `effectiveTheme`, `effectiveThemeColor`, `effectiveDarkModeBaseColor`, `effectiveUseLinearGradient`, `effectiveSearchPageLogoColor`, `shouldSuppressWallpaper`) and `triggerThemePackTransition(e)`.
- Modify: `src/composables/useDark.ts`
  Responsibility: consume `effectiveTheme` for color resolution; short-circuit `toggleDark` writes to `settings.value.theme` when `isNetflixThemePack`; expose the existing view-transition wrapper as `runWithViewTransition(updateFn, e)` so the theme-pack toggle can reuse it.
- Modify: `src/components/AppBackground.vue`
  Responsibility: gate wallpaper rendering on `shouldSuppressWallpaper` at every existing read site.
- Modify: `src/components/TopBar/composables/useTopBarInteraction.ts`
  Responsibility: gate wallpaper-dependent top bar behavior through effective wallpaper state.
- Modify: any component that reads `settings.value.themeColor` / `darkModeBaseColor` / `useLinearGradientThemeColorBackground` / `searchPageLogoColor` for runtime CSS-variable assignment, to consume the `effective*` equivalents (locate via `grep -rn 'themeColor\|darkModeBaseColor\|useLinearGradientThemeColorBackground\|searchPageLogoColor' src/`).
- Modify: `src/contentScripts/views/Home/Home.vue`
  Responsibility: become a thin shell that switches between `HomeClassic` and `HomeNetflix`.
- Create: `src/contentScripts/views/Home/HomeClassic.vue`
  Responsibility: preserve current tab + subpage Home behavior; line-for-line migration of the existing `Home.vue` body.
- Create: `src/contentScripts/views/Home/netflix/HomeNetflix.vue`
- Create: `src/contentScripts/views/Home/netflix/HeroBanner.vue`
- Create: `src/contentScripts/views/Home/netflix/HorizontalRow.vue`
- Create: `src/contentScripts/views/Home/netflix/ContinueWatchingRow.vue`
- Create: `src/contentScripts/views/Home/netflix/Top10Row.vue`
- Create: `src/contentScripts/views/Home/netflix/VideoCardHover.vue`
- Create: `src/contentScripts/views/Home/composables/useHomeRowRegistry.ts`
- Create: `src/contentScripts/views/Home/composables/useForYouData.ts`
- Create: `src/contentScripts/views/Home/composables/useTrendingData.ts`
- Create: `src/contentScripts/views/Home/composables/useRankingData.ts`
- Create: `src/contentScripts/views/Home/composables/useHistoryData.ts`
- Create: `src/contentScripts/views/Home/composables/useFollowingData.ts`
- Create: `src/contentScripts/views/Home/composables/useSubscribedSeriesData.ts`
- Create: `src/contentScripts/views/Home/composables/useWeeklyData.ts`
- Create: `src/contentScripts/views/Home/composables/useLiveData.ts`
- Create: `src/contentScripts/views/Home/composables/usePreciousData.ts`
  Responsibility (composables): each holds **module-scope** singleton reactive state so `HomeClassic` and `HomeNetflix` share the same cache; the composable function returns refs without re-allocating them.
- Modify: SubPage components (`ForYou.vue`, `Trending.vue`, `Ranking.vue`, `Following.vue`, `SubscribedSeries.vue`, `Weekly.vue`, `Live.vue`, `Precious.vue`)
  Responsibility: switch to consuming the extracted composables; **public surface (props / emits / defineExpose) unchanged**.
- Modify: `src/components/VideoCard/VideoCard.vue`
  Responsibility: add `variant` prop and route every preview-gating computed through it.
- Modify: `src/components/VideoCard/composables/useVideoCardLogic.ts` (or whichever composable currently owns preview gating; locate via grep)
  Responsibility: derive `isClassicVariant` once and AND every preview-related computed with it.
- Modify: `src/components/Settings/Appearance/Appearance.vue`
  Responsibility: add the Theme Pack selector + descriptive copy; disable `theme` selector + show locked-by-pack hint when `themePack === 'netflix'`.
- Modify: `src/_locales/en.yml`, `src/_locales/cmn-CN.yml`, `src/_locales/cmn-TW.yml`, `src/_locales/jyut.yml`
  Responsibility: add i18n strings for Theme Pack UI in **all four locales** (no auto-translation).
- Create: `src/tests/themePack.spec.ts`
- Create: `src/tests/homeRowRegistry.spec.ts`
- Create: `src/tests/videoCard.variant.spec.ts`
- Create: `src/tests/heroPicker.spec.ts`
- Modify: `CHANGELOG.md` (or release notes path the project actually uses; verify in Task 7)
- Modify: `package.json` (version bump in Task 7)

---

## Task 1: Theme Pack Runtime Model

**Goal:** Storage field + `useThemePack` composable that exposes every effective override the spec requires, without mutating any persisted setting.

**Files:**
- Modify: `src/logic/storage.ts`
- Create: `src/composables/useThemePack.ts`
- Test: `src/tests/themePack.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it } from 'vitest'

import { settings } from '~/logic'
import { useThemePack } from '~/composables/useThemePack'

describe('useThemePack runtime model', () => {
  beforeEach(() => {
    // explicit reset to avoid time-pollution across tests
    settings.value.themePack = 'default'
    settings.value.theme = 'auto'
    settings.value.themeColor = '#00a1d6'
    settings.value.darkModeBaseColor = '#1a1a1a'
    settings.value.useLinearGradientThemeColorBackground = false
    settings.value.searchPageLogoColor = 'themeColor'
    settings.value.wallpaper = ''
    settings.value.searchPageWallpaper = ''
  })

  it('forces effective dark mode in netflix pack without mutating settings.theme', () => {
    settings.value.themePack = 'netflix'
    settings.value.theme = 'light'
    const { effectiveTheme } = useThemePack()
    expect(effectiveTheme.value).toBe('dark')
    expect(settings.value.theme).toBe('light')
  })

  it('overrides theme color quartet without mutating persisted values', () => {
    settings.value.themePack = 'netflix'
    settings.value.themeColor = '#ff00ff'
    settings.value.useLinearGradientThemeColorBackground = true
    settings.value.searchPageLogoColor = 'white'

    const {
      effectiveThemeColor,
      effectiveDarkModeBaseColor,
      effectiveUseLinearGradient,
      effectiveSearchPageLogoColor,
    } = useThemePack()

    expect(effectiveThemeColor.value).toBe('#E50914')
    expect(effectiveDarkModeBaseColor.value).toBe('#141414')
    expect(effectiveUseLinearGradient.value).toBe(false)
    expect(effectiveSearchPageLogoColor.value).toBe('themeColor')

    // persisted values untouched
    expect(settings.value.themeColor).toBe('#ff00ff')
    expect(settings.value.useLinearGradientThemeColorBackground).toBe(true)
    expect(settings.value.searchPageLogoColor).toBe('white')
  })

  it('suppresses wallpaper without clearing stored values', () => {
    settings.value.themePack = 'netflix'
    settings.value.wallpaper = 'https://example.com/a.jpg'
    settings.value.searchPageWallpaper = 'https://example.com/b.jpg'
    const { shouldSuppressWallpaper } = useThemePack()
    expect(shouldSuppressWallpaper.value).toBe(true)
    expect(settings.value.wallpaper).toBe('https://example.com/a.jpg')
    expect(settings.value.searchPageWallpaper).toBe('https://example.com/b.jpg')
  })

  it('reverts to user values when switching back to default', () => {
    settings.value.theme = 'light'
    settings.value.themeColor = '#ff00ff'
    settings.value.themePack = 'netflix'
    const pack = useThemePack()
    expect(pack.effectiveTheme.value).toBe('dark')
    settings.value.themePack = 'default'
    expect(pack.effectiveTheme.value).toBe('light')
    expect(pack.effectiveThemeColor.value).toBe('#ff00ff')
  })

  it('tolerates corrupt themePack value by falling back to default', () => {
    // simulate storage corruption
    ;(settings.value as any).themePack = 'totally-bogus'
    const { isNetflixThemePack } = useThemePack()
    expect(isNetflixThemePack.value).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/tests/themePack.spec.ts
```

Expected: FAIL (`useThemePack` and `themePack` field do not exist).

- [ ] **Step 3: Implement**

Storage:

```ts
// src/logic/storage.ts
export type ThemePackSetting = 'default' | 'netflix'

// in Settings interface, near `theme`:
themePack: ThemePackSetting

// in default settings object:
themePack: 'default',
```

Composable (use `usePreferredDark` from VueUse for system theme — do NOT call `window.matchMedia(...).matches` synchronously; that's not reactive):

```ts
// src/composables/useThemePack.ts
import { usePreferredDark } from '@vueuse/core'

import { settings } from '~/logic'

const NETFLIX_PALETTE = {
  themeColor: '#E50914',
  darkModeBaseColor: '#141414',
} as const

export function useThemePack() {
  const preferredDark = usePreferredDark()

  const isNetflixThemePack = computed(() => settings.value.themePack === 'netflix')

  const effectiveTheme = computed<'light' | 'dark'>(() => {
    if (isNetflixThemePack.value)
      return 'dark'
    if (settings.value.theme === 'auto')
      return preferredDark.value ? 'dark' : 'light'
    return settings.value.theme
  })

  const effectiveThemeColor = computed(() =>
    isNetflixThemePack.value ? NETFLIX_PALETTE.themeColor : settings.value.themeColor,
  )
  const effectiveDarkModeBaseColor = computed(() =>
    isNetflixThemePack.value ? NETFLIX_PALETTE.darkModeBaseColor : settings.value.darkModeBaseColor,
  )
  const effectiveUseLinearGradient = computed(() =>
    isNetflixThemePack.value ? false : settings.value.useLinearGradientThemeColorBackground,
  )
  const effectiveSearchPageLogoColor = computed(() =>
    isNetflixThemePack.value ? 'themeColor' : settings.value.searchPageLogoColor,
  )
  const shouldSuppressWallpaper = computed(() => isNetflixThemePack.value)

  return {
    isNetflixThemePack,
    effectiveTheme,
    effectiveThemeColor,
    effectiveDarkModeBaseColor,
    effectiveUseLinearGradient,
    effectiveSearchPageLogoColor,
    shouldSuppressWallpaper,
  }
}
```

- [ ] **Step 4: Run tests** — `pnpm test -- src/tests/themePack.spec.ts` → PASS.
- [ ] **Step 5: Run typecheck** — `pnpm typecheck` → PASS.
- [ ] **Step 6: Commit**

```bash
git add src/logic/storage.ts src/composables/useThemePack.ts src/tests/themePack.spec.ts
git commit -m "feat(theme-pack): add runtime override composable and storage field"
```

**Rollback boundary:** Single commit; revert with `git revert <sha>`. No downstream code consumes `useThemePack` yet, so revert is safe.

---

## Task 2: Wire Effective Overrides Into Existing Consumers

**Goal:** Every existing read of `settings.value.{theme,themeColor,darkModeBaseColor,useLinearGradientThemeColorBackground,searchPageLogoColor,wallpaper,searchPageWallpaper}` that drives runtime appearance switches to the corresponding `effective*` ref. `useDark.toggleDark` short-circuits in Netflix mode and exposes a `runWithViewTransition` helper for the theme-pack toggle to reuse.

**Files:**
- Modify: `src/composables/useDark.ts`
- Modify: `src/components/AppBackground.vue`
- Modify: `src/components/TopBar/composables/useTopBarInteraction.ts`
- Modify: any other file located via the grep below
- Test: `src/tests/themePack.spec.ts` (extend with regression coverage)

- [ ] **Step 1: Map every consumer**

Run and record output (paste into PR description):

```bash
grep -rn "settings\.value\.theme\b\|settings\.value\.themeColor\|settings\.value\.darkModeBaseColor\|settings\.value\.useLinearGradientThemeColorBackground\|settings\.value\.searchPageLogoColor\|settings\.value\.wallpaper\|settings\.value\.searchPageWallpaper" src/
```

For each hit, decide:
- **runtime appearance consumer** → must switch to `effective*`
- **settings UI write site** → keep writing `settings.value.*` (user intent)
- **persistence/migration code** → keep as-is

- [ ] **Step 2: Extend tests**

```ts
it('toggleDark is a no-op for settings.theme when netflix pack is active', async () => {
  const { toggleDark } = await import('~/composables/useDark').then(m => m.useDark())
  settings.value.theme = 'light'
  settings.value.themePack = 'netflix'
  // synthesize a minimal MouseEvent
  toggleDark({ clientX: 0, clientY: 0 } as MouseEvent)
  expect(settings.value.theme).toBe('light')
})

it('AppBackground gates rendering on shouldSuppressWallpaper', async () => {
  // mount AppBackground in suppressed and unsuppressed states; assert wallpaper element absent in suppressed.
})
```

- [ ] **Step 3: Run tests** → expect FAIL on the new assertions until Step 4 lands.

- [ ] **Step 4: Implement**

`useDark.ts` changes:

```ts
// at top of useDark()
const { effectiveTheme, isNetflixThemePack } = useThemePack()

// replace `currentAppColorScheme`'s body with effectiveTheme, but keep its name + return value
const currentAppColorScheme = computed<'dark' | 'light'>(() => effectiveTheme.value)
const isDark = computed(() => currentAppColorScheme.value === 'dark')

// in toggleDark(), wrap the existing `updateThemeSettings()` body with a guard:
function updateThemeSettings() {
  if (isNetflixThemePack.value) {
    // Netflix pack owns the appearance — do not mutate settings.theme.
    return
  }
  // ... existing logic that writes settings.value.theme ...
}
```

Also extract the view-transition wrapper into a reusable helper so the theme-pack toggle (Task 3) can call it without duplicating shadow-DOM transition code:

```ts
export function runWithViewTransition(update: () => void | Promise<void>, e: MouseEvent) {
  // body lifted out of toggleDark's `else` branch unchanged
}
```

`AppBackground.vue` changes (apply `shouldSuppressWallpaper` at every wallpaper read; do not delete the read sites — gate them):

```vue
<script setup lang="ts">
const { shouldSuppressWallpaper } = useThemePack()
const wallpaperUrl = computed(() => shouldSuppressWallpaper.value ? '' : settings.value.wallpaper)
const searchWallpaperUrl = computed(() => shouldSuppressWallpaper.value ? '' : settings.value.searchPageWallpaper)
</script>
```

`useTopBarInteraction.ts`: gate the existing wallpaper-aware branches on `shouldSuppressWallpaper.value === false`.

For each runtime consumer of `themeColor` / `darkModeBaseColor` / `useLinearGradientThemeColorBackground` / `searchPageLogoColor` (locations from Step 1), swap to the `effective*` ref. Settings UI files keep reading/writing the persistent `settings.*` (user intent).

- [ ] **Step 5: Manual verification matrix** (record results in PR):

| Page | themePack=default behavior unchanged | themePack=netflix shows palette |
|---|---|---|
| Home | ✅ | dark + red + no wallpaper |
| Anime | ✅ | dark + red |
| Search | ✅ | dark + red logo, no search-page wallpaper |
| Favorites / History / WatchLater / Moments | ✅ | dark + red |
| Video detail (right-side recommend cards still grid-style) | ✅ | dark + red, cards still grid |

- [ ] **Step 6: Run** `pnpm test && pnpm typecheck && pnpm lint` → all PASS.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(theme-pack): route appearance/wallpaper consumers through effective overrides"
```

**Rollback boundary:** This task touches existing code paths. If regressions surface in default mode, revert this single commit; Task 1 alone is harmless because nothing consumes the composable.

---

## Task 3: Settings UI

**Goal:** Add the Theme Pack selector. When `themePack === 'netflix'`, disable the existing theme (light/dark/auto) radio with a tooltip explaining Netflix locks it.

**Files:**
- Modify: `src/components/Settings/Appearance/Appearance.vue`
- Modify: `src/_locales/en.yml`
- Modify: `src/_locales/cmn-CN.yml`
- Modify: `src/_locales/cmn-TW.yml`
- Modify: `src/_locales/jyut.yml`

- [ ] **Step 1: Add UI** — radio group bound to `settings.themePack`; existing theme radio gains `:disabled="settings.themePack === 'netflix'"` plus a hover hint.

- [ ] **Step 2: Add i18n keys in all four locales** (do not auto-translate; native or careful manual translation only):

```yaml
# en.yml
settings:
  group_theme_pack: Theme pack
  theme_pack: Theme pack
  theme_pack_default: Default
  theme_pack_netflix: Netflix
  theme_pack_netflix_desc: Forces dark mode + Netflix red, replaces Home with row layout, hides wallpaper. Your saved theme/wallpaper are preserved.
  theme_locked_by_pack: Locked by Netflix theme pack
```

```yaml
# cmn-CN.yml
settings:
  group_theme_pack: 主题包
  theme_pack: 主题包
  theme_pack_default: 默认
  theme_pack_netflix: Netflix
  theme_pack_netflix_desc: 强制启用暗色 + Netflix 红，将首页改为 row 布局，隐藏壁纸。你保存的主题/壁纸设置不会被修改。
  theme_locked_by_pack: 由 Netflix 主题包锁定
```

```yaml
# cmn-TW.yml
settings:
  group_theme_pack: 佈景主題包
  theme_pack: 佈景主題包
  theme_pack_default: 預設
  theme_pack_netflix: Netflix
  theme_pack_netflix_desc: 強制啟用深色 + Netflix 紅，將首頁改為 row 佈局，隱藏桌布。你儲存的主題/桌布設定不會被修改。
  theme_locked_by_pack: 由 Netflix 佈景主題包鎖定
```

```yaml
# jyut.yml — leave keys present; if maintainer is not fluent in Cantonese, add a comment marking these as "needs review" and copy zh-CN values as placeholder
settings:
  group_theme_pack: 主題包  # TODO: Cantonese review
  theme_pack: 主題包  # TODO: Cantonese review
  theme_pack_default: 預設
  theme_pack_netflix: Netflix
  theme_pack_netflix_desc: 強制開啟深色 + Netflix 紅，將首頁改為 row 佈局，隱藏桌布。  # TODO: Cantonese review
  theme_locked_by_pack: 由 Netflix 主題包鎖定  # TODO: Cantonese review
```

- [ ] **Step 3: Switching transition** — the radio's `@change` handler calls `runWithViewTransition` (from Task 2) before writing `settings.value.themePack`. The wrapper handles shadow-DOM-safe transitions; if `document.startViewTransition` is unavailable (Firefox), it must fall back to a no-op write.

- [ ] **Step 4: Verify**

```bash
pnpm typecheck
pnpm lint
```

Manual: open the extension, switch themePack twice, confirm the page transitions and the theme radio greys out under Netflix.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(theme-pack): settings UI for switching theme packs"
```

**Rollback boundary:** Single commit; revert removes the entry point but leaves Task 1/2 infra in place.

---

## Task 4: Home Shell Split

**Goal:** Reduce `Home.vue` to a thin shell that picks `HomeClassic` or `HomeNetflix` based on `themePack`. `HomeClassic.vue` is a **line-for-line lift** of the current `Home.vue` body — no behavior change in default mode.

**Files:**
- Modify: `src/contentScripts/views/Home/Home.vue`
- Create: `src/contentScripts/views/Home/HomeClassic.vue`

- [ ] **Step 1: Migration checklist (must complete before writing code)**

Document inline in this task (paste into PR), based on Task 0's snapshot:

- [ ] All `provide()` keys called by Home.vue, with consumers identified
- [ ] All `defineExpose` entries
- [ ] All scroll-related state: cached scroll top, top-bar visibility anchor, scroll thresholds, throttled back-to-top
- [ ] All emitter (`mitt`) listeners and emitters
- [ ] Watchers on `settings.homePageTabVisibilityList`
- [ ] Async-component map for sub-pages
- [ ] Lifecycle hooks (`onMounted`, `onActivated`, etc.)
- [ ] CSS / class scoping

- [ ] **Step 2: Implement the shell**

```vue
<!-- Home.vue -->
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useThemePack } from '~/composables/useThemePack'

const { isNetflixThemePack } = useThemePack()

const HomeClassic = defineAsyncComponent({
  loader: () => import('./HomeClassic.vue'),
  delay: 0,
})
const HomeNetflix = defineAsyncComponent({
  loader: () => import('./netflix/HomeNetflix.vue'),
  delay: 0,
  loadingComponent: () => h('div', { class: 'netflix-loading' }),
})
</script>

<template>
  <component :is="isNetflixThemePack ? HomeNetflix : HomeClassic" />
</template>
```

- [ ] **Step 3: Move all of `Home.vue`'s body (script, template, style) into `HomeClassic.vue`** verbatim; resolve `~` import paths as needed.

- [ ] **Step 4: Equivalence verification (default mode)**

Manual checklist (record pass/fail in PR):

- [ ] Tab switching still highlights correctly
- [ ] Scroll-driven top-bar hide/show still triggers
- [ ] Virtual scrolling on grid still works (no layout shift)
- [ ] Back-to-top button visible at threshold
- [ ] All 8 SubPages mount without error
- [ ] `homePageTabVisibilityList` toggling still updates tabs

```bash
pnpm test
pnpm typecheck
pnpm lint
```

All PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(home): extract HomeClassic shell, no behavior change"
```

**Rollback boundary:** Two-file diff. Revert restores the original Home.vue. Verify `git diff HEAD~1 HEAD -- src/contentScripts/views/Home/HomeClassic.vue src/contentScripts/views/Home/Home.vue` shows only the split, no semantic edits.

---

## Task 5: Shared Home Data Composables

**Goal:** Extract data fetching from each SubPage into singleton, module-scope composables that HomeClassic and HomeNetflix share. SubPage public surface (props/emits/expose) does not change.

**Files:**
- Create: 9 composables under `src/contentScripts/views/Home/composables/` (one per SubPage data source + `useHistoryData` for Continue Watching)
- Modify: 8 SubPage components

- [ ] **Step 1: Test contract for representative composable**

```ts
// src/tests/homeDataComposables.spec.ts (or an existing aggregate file)
import { afterEach, describe, expect, it } from 'vitest'

import { _resetForTest, useTrendingData } from '~/contentScripts/views/Home/composables/useTrendingData'

describe('useTrendingData (singleton)', () => {
  afterEach(() => _resetForTest())

  it('returns the same reactive items ref across calls (singleton)', () => {
    const a = useTrendingData()
    const b = useTrendingData()
    expect(a.items).toBe(b.items)
  })

  it('exposes load() with retry-able error state', async () => {
    const { error, load } = useTrendingData({ fetchTrending: () => Promise.reject(new Error('boom')) })
    await load()
    expect(error.value?.message).toBe('boom')
  })
})
```

- [ ] **Step 2: Run** → FAIL (composable absent).

- [ ] **Step 3: Singleton template**

```ts
// src/contentScripts/views/Home/composables/useTrendingData.ts
import { ref } from 'vue'

const items = ref<any[]>([])
const loading = ref(false)
const error = ref<Error | null>(null)
let inflight: Promise<void> | null = null

interface Deps { fetchTrending: () => Promise<any[]> }

let deps: Deps = { fetchTrending: defaultFetchTrending }

export function useTrendingData(override?: Partial<Deps>) {
  if (override)
    deps = { ...deps, ...override }
  return { items, loading, error, load }

  async function load() {
    if (inflight)
      return inflight
    loading.value = true
    error.value = null
    inflight = (async () => {
      try { items.value = await deps.fetchTrending() }
      catch (e) { error.value = e as Error }
      finally { loading.value = false; inflight = null }
    })()
    return inflight
  }
}

export function _resetForTest() {
  items.value = []
  loading.value = false
  error.value = null
  inflight = null
  deps = { fetchTrending: defaultFetchTrending }
}
```

Repeat for the 8 other composables. **`useHistoryData` is independent** — it has no SubPage; it powers the Continue Watching row only and its consumer is `ContinueWatchingRow.vue`.

- [ ] **Step 4: Migrate one SubPage end-to-end**, verify equivalence, then repeat for the remaining 7.

For each SubPage migration, record (PR description):

- [ ] Original `<script setup>` data refs
- [ ] Composable now backing each ref
- [ ] Public surface (props/emits/defineExpose) unchanged — show `git diff` of the surface

- [ ] **Step 5: Default-mode regression sweep**

Manual: open Home, click each tab, confirm load, retry on simulated network failure (devtools throttling), confirm no double-fetch when re-clicking the same tab.

```bash
pnpm test
pnpm typecheck
pnpm lint
```

- [ ] **Step 6: Commit per SubPage** (8 commits, one per SubPage migration; use `git commit --no-verify` only if explicitly authorized, otherwise pre-commit hooks must pass).

**Rollback boundary:** Per-SubPage commits make targeted revert possible. If SubPage N is broken, `git revert` only that commit.

---

## Task 6: Netflix Home Layout Skeleton

**Goal:** Render Hero + horizontal rows + Top10 + Continue Watching; no hover overlay yet. Cards use `VideoCard` with `variant='netflix-row'`.

**Files:**
- Create: `src/contentScripts/views/Home/netflix/HomeNetflix.vue`
- Create: `src/contentScripts/views/Home/netflix/HeroBanner.vue`
- Create: `src/contentScripts/views/Home/netflix/HorizontalRow.vue`
- Create: `src/contentScripts/views/Home/netflix/ContinueWatchingRow.vue`
- Create: `src/contentScripts/views/Home/netflix/Top10Row.vue`
- Create: `src/contentScripts/views/Home/composables/useHomeRowRegistry.ts`
- Test: `src/tests/homeRowRegistry.spec.ts`, `src/tests/heroPicker.spec.ts`

- [ ] **Step 1: Failing tests**

```ts
// homeRowRegistry.spec.ts
import { describe, expect, it } from 'vitest'

import { buildNetflixHomeRows } from '~/contentScripts/views/Home/composables/useHomeRowRegistry'
import { HomeSubPage } from '~/contentScripts/views/Home/types'

describe('netflix home row registry', () => {
  it('orders fixed rows ahead of subpage rows; respects user visibility + order', () => {
    const rows = buildNetflixHomeRows([
      { page: HomeSubPage.Trending, visible: true },
      { page: HomeSubPage.Live, visible: false },
      { page: HomeSubPage.ForYou, visible: true },
    ])
    expect(rows.map(r => r.key)).toEqual(['hero', 'continue-watching', 'top10', HomeSubPage.Trending, HomeSubPage.ForYou])
  })
})
```

```ts
// heroPicker.spec.ts
import { describe, expect, it } from 'vitest'

import { pickHeroCandidate } from '~/contentScripts/views/Home/netflix/HomeNetflix'

describe('pickHeroCandidate', () => {
  const lowQuality = { id: 'a', coverScore: 30 }
  const highQuality = { id: 'b', coverScore: 80 }
  const noScore = { id: 'c' }

  it('picks first trending item with coverScore >= threshold', () => {
    expect(pickHeroCandidate([lowQuality, highQuality], [])?.id).toBe('b')
  })
  it('falls back to forYou first item when trending all below threshold', () => {
    expect(pickHeroCandidate([lowQuality], [highQuality])?.id).toBe('b')
  })
  it('falls back to first trending item when no scores present', () => {
    expect(pickHeroCandidate([noScore], [])?.id).toBe('c')
  })
  it('returns null when both empty', () => {
    expect(pickHeroCandidate([], [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

```ts
// useHomeRowRegistry.ts
const FIXED_HEAD = ['hero', 'continue-watching', 'top10'] as const

export function buildNetflixHomeRows(visibility: { page: HomeSubPage, visible: boolean }[]) {
  const dynamic = visibility.filter(v => v.visible).map(v => ({ key: v.page, kind: 'subpage' as const, page: v.page }))
  return [
    { key: 'hero', kind: 'hero' as const },
    { key: 'continue-watching', kind: 'continue' as const },
    { key: 'top10', kind: 'top10' as const },
    ...dynamic,
  ]
}
```

```ts
// HomeNetflix.vue (export pickHeroCandidate as a named export, not default)
const HERO_COVER_SCORE_THRESHOLD = 60

export function pickHeroCandidate<T extends { coverScore?: number }>(
  trending: T[],
  forYou: T[],
): T | null {
  const fromTrending = trending.find(v => (v.coverScore ?? Number.POSITIVE_INFINITY) >= HERO_COVER_SCORE_THRESHOLD)
  if (fromTrending)
    return fromTrending
  return trending[0] ?? forYou[0] ?? null
}
```

- [ ] **Step 4: HorizontalRow with overflow** — `overflow-x: auto`. Hover overlay (Task 7) will Teleport out, so the row's `overflow-y` clipping is acceptable here.

- [ ] **Step 5: Wire to composables** — each row pulls from its singleton composable; HomeNetflix triggers `load()` on mount for visible rows only (lazy-load below-fold via IntersectionObserver if perf demands).

- [ ] **Step 6: Manual checklist**

- [ ] Netflix Home renders Hero (or skips it without a blank slot)
- [ ] Each row scrolls horizontally with mouse wheel + arrow buttons
- [ ] Switching tabs in default mode still works (no Netflix code loaded for those users)

```bash
pnpm test && pnpm typecheck && pnpm lint
```

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(theme-pack): netflix home skeleton (hero + rows, no overlay)"
```

**Rollback boundary:** Adding new files only, plus updating `useHomeRowRegistry`. Revert is safe.

---

## Task 7: VideoCard Variant + Hover Overlay (Teleport)

**Goal:** `VideoCard.variant='netflix-row'` renders 16:9 horizontally; preview behavior fully suppressed for the variant; hover triggers `<VideoCardHover>` Teleported to the Home container.

**Files:**
- Modify: `src/components/VideoCard/VideoCard.vue`
- Modify: the composable that owns preview gating (locate via grep; likely `src/components/VideoCard/composables/useVideoCardLogic.ts`)
- Create: `src/contentScripts/views/Home/netflix/VideoCardHover.vue`
- Test: `src/tests/videoCard.variant.spec.ts`

- [ ] **Step 1: Behavior tests (not string matching)**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import VideoCard from '~/components/VideoCard/VideoCard.vue'

describe('VideoCard variant', () => {
  const baseProps = { video: { id: '1', cover: '//x/a.jpg', title: 'T' } as any, showPreview: true }

  it('renders preview component for grid variant', async () => {
    const w = mount(VideoCard, { props: baseProps })
    // assert by component lookup, not html string
    expect(w.findComponent({ name: 'VideoCardPreview' }).exists()).toBe(true)
  })

  it('does NOT render preview component for netflix-row variant, even when showPreview=true', async () => {
    const w = mount(VideoCard, { props: { ...baseProps, variant: 'netflix-row' } })
    expect(w.findComponent({ name: 'VideoCardPreview' }).exists()).toBe(false)
  })

  it('default variant is grid (back-compat)', async () => {
    const w = mount(VideoCard, { props: baseProps })
    // any pre-existing default-mode visual marker the codebase already exposes
    expect(w.props('variant')).toBe('grid')
  })
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

```ts
// VideoCard.vue
interface Props { variant?: 'grid' | 'netflix-row'; /* existing props */ }
const props = withDefaults(defineProps<Props>(), { variant: 'grid' })

const isClassicVariant = computed(() => props.variant !== 'netflix-row')
// AND every existing preview-related computed with isClassicVariant.value
// Audit list (from Task 0 snapshot):
//   - shouldLoadPreview
//   - shouldShowPreviewVideo
//   - hoverPreviewEnabled
//   - any other preview/hover flag found via grep
```

`VideoCardHover.vue` Teleports to a target the Home container provides:

```vue
<template>
  <Teleport :to="hoverTarget" :disabled="!hoverTarget">
    <div class="netflix-card-hover" :style="positionStyle">
      <!-- play / +watchlater / like / detail / metadata -->
    </div>
  </Teleport>
</template>
```

`HomeNetflix.vue` provides the hover target:

```vue
<div ref="hoverTargetRef" class="netflix-home">
  <!-- rows -->
</div>
```

```ts
provide('netflix-hover-target', hoverTargetRef)
```

- [ ] **Step 4: Card "+ My List" button reuses watch-later flow**

The button in `VideoCardHover` calls the existing watch-later API (locate via `grep -rn 'watchLater\|watch_later\|稍后再看' src/utils/`). Reuse the existing icon and i18n key — no new keys.

- [ ] **Step 5: Regression check — VideoCard on Video Detail page**

Manual:
- [ ] Open a video detail page with `themePack='default'` — right-side recommend cards visually identical to main.
- [ ] Switch to `themePack='netflix'` — recommend cards still **grid variant** (variant prop not passed → default), look unchanged in shape, only colors flipped.

- [ ] **Step 6: Verify**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(theme-pack): video card netflix-row variant + teleported hover"
```

**Rollback boundary:** Affects shared `VideoCard.vue`. If regression in default mode, revert this commit; previous tasks remain functional (Netflix Home renders with whatever the prior card behavior was).

---

## Task 8: Top10 Numbers, Hero Carousel, Polish

**Goal:** Visual richness — TOP 10 oversized SVG numbers, Hero carousel with gradient overlay + auto-rotate + mute toggle, NEW/N badges, progress bar on Continue Watching.

**Files:**
- Modify: `src/contentScripts/views/Home/netflix/Top10Row.vue`
- Modify: `src/contentScripts/views/Home/netflix/HeroBanner.vue`
- Modify: `src/contentScripts/views/Home/netflix/ContinueWatchingRow.vue`
- (any small helper additions as needed)

- [ ] Implement TOP 10 numbers as inline SVG (matrix uses `clamp(120px, 18vw, 240px)`)
- [ ] Implement Hero carousel (3 slides, 8s rotate, pause on hover, mute toggle)
- [ ] Implement progress bar on Continue Watching cards
- [ ] Implement NEW/N badges (CSS-only)
- [ ] Manual verification against mockup
- [ ] Run `pnpm test && pnpm typecheck && pnpm lint`
- [ ] Commit per visual element if helpful

**Rollback boundary:** Visual-only commits. Easy to revert any single visual without affecting logic.

---

## Task 9: Cross-browser Verification + Release Hygiene

**Files:**
- Modify: `CHANGELOG.md` (verify path; if absent, check release notes location)
- Modify: `package.json` (version bump per project convention — patch vs minor decided by project owner before commit)

- [ ] **Cross-browser matrix** (record results in PR):

| Browser | themePack=default smoke | themePack=netflix smoke | view-transition works | Notes |
|---|---|---|---|---|
| Chrome (latest) | ✅ | ✅ | ✅ | |
| Edge (latest) | ✅ | ✅ | ✅ | |
| Firefox (latest stable) | ✅ | ✅ | fallback to no-transition? | record |

If Firefox view-transition fails: confirm `runWithViewTransition` fallback executes the update without the animation — zero-functional regression is the bar; missing animation is acceptable.

- [ ] **Run final test sweep:**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm build-firefox
```

All PASS. No new lint warnings beyond baseline.

- [ ] **CHANGELOG entry** — feat: Netflix theme pack (under upcoming release section).

- [ ] **Version bump** — confer with maintainer before committing.

- [ ] **Commit**

```bash
git commit -m "chore(release): netflix theme pack changelog and version bump"
```

**Rollback boundary:** Release-metadata-only commit; trivial revert.

---

## Spec Coverage Check

| Spec § | Plan task |
|---|---|
| 决议 #1 storage field | Task 1 |
| 决议 #2 effective theme + toggleDark short-circuit + theme radio disabled | Task 1, 2, 3 |
| 决议 #3 hero coverScore threshold + fallbacks | Task 6 |
| 决议 #4 Teleport hover overlay | Task 7 |
| 决议 #5 reuse watch-later for "+ my list" | Task 7 Step 4 |
| 决议 #6 row order (Hero → Continue → TOP 10 → SubPage by user list) | Task 6 |
| 决议 #7 wallpaper suppression at AppBackground / TopBar / Search | Task 2 |
| 决议 #8 themeColor / darkBase / linearGradient / searchPageLogoColor effective overrides | Task 1, 2 |
| 决议 #9 singleton composables | Task 5 |
| 决议 #10 loadingComponent + delay:0 | Task 4, plus reused in Task 6 |
| Risk: Home.vue migration | Task 4 explicit checklist |
| Risk: Firefox view-transition | Task 9 |
| Risk: VideoCard reused on video detail page | Task 7 Step 5 |
| Test strategy: composable success/failure paths | Task 5 |
| Test strategy: VideoCard variant behavior (not string) | Task 7 |
| Test strategy: regression sweeps | Task 4, 5, 9 |

## Self-Review Notes

- All 10 spec decisions have explicit task coverage above.
- Every task lists a **rollback boundary** so any single failure can be reverted without cascading.
- TDD pattern enforced: every code-introducing task has a failing test → implementation → green test → commit.
- No string-matching tests; behavior assertions only.
- i18n: en + cmn-CN + cmn-TW given verbatim; jyut marked TODO for native review (avoiding low-quality auto-translation).
- `useDark.toggleDark` short-circuit is the resolution to the spec's "do not mutate persistent settings" decision; called out explicitly in Task 2 Step 4.
- Wallpaper suppression covers `AppBackground.vue` (the main consumer the previous draft missed) plus TopBar and Search.
- Singleton data composables avoid duplicate fetches between Classic and Netflix layouts.
- `defineAsyncComponent` configured with `delay: 0` + `loadingComponent` to avoid white-flash during view-transition.
- VideoCard regression on video detail page explicitly verified in Task 7 Step 5.
