import { createSharedComposable, usePreferredDark } from '@vueuse/core'
import { computed } from 'vue'

import { settings } from '~/logic'

const NETFLIX_PALETTE = {
  themeColor: '#E50914',
  darkModeBaseColor: '#141414',
} as const

function _useThemePack() {
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

// 单例：所有调用方共享同一组 computed 与 usePreferredDark 监听，
// 避免每个组件 mount 都新建 7 个 computed + 1 个 matchMedia 监听
export const useThemePack = createSharedComposable(_useThemePack)
