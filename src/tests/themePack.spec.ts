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
