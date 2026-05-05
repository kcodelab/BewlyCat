import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDark } from '~/composables/useDark'
import { useThemePack } from '~/composables/useThemePack'
import { settings } from '~/logic'

// Mock webextension-polyfill so storage.ts can be imported in jsdom
vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}))

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

describe('useDark + useThemePack integration', () => {
  beforeEach(() => {
    settings.value.themePack = 'default'
    settings.value.theme = 'auto'
  })

  it('toggleDark is a no-op for settings.theme when netflix pack is active', () => {
    // Set state BEFORE invoking useDark() so its internal computeds capture the right values.
    settings.value.theme = 'light'
    settings.value.themePack = 'netflix'

    const { toggleDark } = useDark()
    toggleDark({ clientX: 0, clientY: 0 } as MouseEvent)

    expect(settings.value.theme).toBe('light')
  })
})

describe('appBackground wallpaper suppression (render gate)', () => {
  beforeEach(() => {
    settings.value.themePack = 'default'
    settings.value.wallpaper = ''
    settings.value.searchPageWallpaper = ''
  })

  // Skipped: AppBackground.vue requires @vue/test-utils (not installed) and a chain of
  // browser-API-heavy dependencies (useStorageLocal → webextension-polyfill, IndexedDB-based
  // wallpaperCache, shadow-DOM querySelector calls). A DOM-level mount cannot be set up
  // cleanly in the current jsdom-only test environment without significant additional mocking.
  //
  // The composable-level invariant — shouldSuppressWallpaper being true whenever
  // themePack='netflix' — is already covered by the 'suppresses wallpaper without clearing
  // stored values' test above, and AppBackground.vue's own guards read directly from that
  // computed (resolveGlobalWallpaper / resolveSearchWallpaper both short-circuit when
  // shouldSuppressWallpaper.value is true).
  it.skip('appBackground: netflix pack suppresses wallpaper DOM node (needs @vue/test-utils)', () => {
    // When @vue/test-utils is added:
    // 1. mount(AppBackground, { props: { activatedPage: AppPage.Search } }) with
    //    themePack='default' + wallpaper set → assert backgroundImage !== ''
    // 2. switch themePack='netflix' → assert backgroundImage === '' (resolvedWallpaper cleared)
  })

  it('shouldSuppressWallpaper drives AppBackground wallpaper to empty (composable-level)', () => {
    // Verify the composable gate that AppBackground.vue relies on.
    settings.value.wallpaper = 'https://example.com/bg.jpg'
    settings.value.searchPageWallpaper = 'https://example.com/sbg.jpg'

    const { shouldSuppressWallpaper } = useThemePack()

    // default pack: no suppression
    expect(shouldSuppressWallpaper.value).toBe(false)

    // netflix pack: suppress
    settings.value.themePack = 'netflix'
    expect(shouldSuppressWallpaper.value).toBe(true)

    // stored values still intact (AppBackground reads these only when NOT suppressed)
    expect(settings.value.wallpaper).toBe('https://example.com/bg.jpg')
    expect(settings.value.searchPageWallpaper).toBe('https://example.com/sbg.jpg')
  })
})

describe('home search-page-mode wallpaper suppression', () => {
  beforeEach(() => {
    settings.value.themePack = 'default'
    settings.value.useSearchPageModeOnHomePage = false
    settings.value.individuallySetSearchPageWallpaper = false
    settings.value.searchPageWallpaper = ''
  })

  // The Home.vue template renders the search-page-mode wallpaper background with:
  //   v-if="!shouldSuppressWallpaper && settings.useSearchPageModeOnHomePage
  //         && settings.individuallySetSearchPageWallpaper && showSearchPageMode"
  //
  // Direct component mounting is avoided (Home.vue pulls in every sub-page via
  // defineAsyncComponent, requires router, pinia stores, emitter, and CSS variables)
  // and @vue/test-utils is not installed. Instead we validate the boolean expression
  // that drives the v-if as a pure unit test.
  it('v-if gate: netflix pack suppresses search-page wallpaper regardless of other flags', () => {
    settings.value.useSearchPageModeOnHomePage = true
    settings.value.individuallySetSearchPageWallpaper = true
    settings.value.searchPageWallpaper = 'https://example.com/bg.jpg'
    const showSearchPageMode = true // simulates the ref being true

    const { shouldSuppressWallpaper } = useThemePack()

    // default pack: all flags true → wallpaper section would render
    const renderWithDefault
      = !shouldSuppressWallpaper.value
        && settings.value.useSearchPageModeOnHomePage
        && settings.value.individuallySetSearchPageWallpaper
        && showSearchPageMode
    expect(renderWithDefault).toBe(true)

    // netflix pack: shouldSuppressWallpaper flips → wallpaper section must NOT render
    settings.value.themePack = 'netflix'
    const renderWithNetflix
      = !shouldSuppressWallpaper.value
        && settings.value.useSearchPageModeOnHomePage
        && settings.value.individuallySetSearchPageWallpaper
        && showSearchPageMode
    expect(renderWithNetflix).toBe(false)

    // stored user setting untouched
    expect(settings.value.searchPageWallpaper).toBe('https://example.com/bg.jpg')
  })

  it('v-if gate: default pack preserves wallpaper rendering when all conditions met', () => {
    settings.value.useSearchPageModeOnHomePage = true
    settings.value.individuallySetSearchPageWallpaper = true
    const showSearchPageMode = true

    const { shouldSuppressWallpaper } = useThemePack()

    const renders
      = !shouldSuppressWallpaper.value
        && settings.value.useSearchPageModeOnHomePage
        && settings.value.individuallySetSearchPageWallpaper
        && showSearchPageMode
    expect(renders).toBe(true)
  })
})
