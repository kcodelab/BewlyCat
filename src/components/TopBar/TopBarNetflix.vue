<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { useBewlyApp } from '~/composables/useAppProvider'
import { useThemePack } from '~/composables/useThemePack'
import { OVERLAY_SCROLL_BAR_SCROLL } from '~/constants/globalEvents'
import { AppPage } from '~/enums/appEnums'
import { settings } from '~/logic'
import { useTopBarStore } from '~/stores/topBarStore'
import { isHomePage } from '~/utils/main'
import emitter from '~/utils/mitt'

import MyListMenu from './components/MyListMenu.vue'
import NotificationsDrawer from './components/NotificationsDrawer.vue'
import TopBarRight from './components/TopBarRight.vue'
import TopBarSearch from './components/TopBarSearch.vue'
import { useTopBarInteraction } from './composables/useTopBarInteraction'

const emit = defineEmits<{
  (e: 'navigate', page: AppPage): void
  (e: 'openSettings'): void
}>()

const { activatedPage } = useBewlyApp()
const { effectiveThemeColor } = useThemePack()
const { handleNotificationsItemClick } = useTopBarInteraction()
const topBarStore = useTopBarStore()

// Initialize user info and timers (same as TopBar.vue) so that login state
// is refreshed on page load — including after logout + reload.
onMounted(() => {
  topBarStore.initData().then(() => {
    if (topBarStore.isLogin)
      topBarStore.startUpdateTimer()
  })
})

onUnmounted(() => {
  topBarStore.cleanup()
})

// Scroll-driven topbar transparency (Netflix style)
const SCROLL_OPAQUE_THRESHOLD = 80
const scrollTop = ref(0)
const isScrolled = computed(() => scrollTop.value > SCROLL_OPAQUE_THRESHOLD)

function handleOverlayScroll(top: number) {
  scrollTop.value = top
}

function handleWindowScroll() {
  // 二级页面（B 站原生页）BewlyCat 不接管渲染，用原生 window 滚动；
  // Home 页面用 OVERLAY_SCROLL_BAR_SCROLL，window scrollY 不变。
  // 取两个来源的最大值，谁滚谁说了算
  const winTop = window.scrollY || document.documentElement.scrollTop || 0
  if (winTop > scrollTop.value)
    scrollTop.value = winTop
  else if (winTop !== scrollTop.value && winTop < SCROLL_OPAQUE_THRESHOLD)
    scrollTop.value = winTop
}

onMounted(() => {
  // 初始读一次原生 scrollTop（兜底，避免 mitt 事件首次触发前透明度异常）
  scrollTop.value = document.documentElement.scrollTop
  emitter.on(OVERLAY_SCROLL_BAR_SCROLL, handleOverlayScroll)
  window.addEventListener('scroll', handleWindowScroll, { passive: true })
})

onUnmounted(() => {
  emitter.off(OVERLAY_SCROLL_BAR_SCROLL, handleOverlayScroll)
  window.removeEventListener('scroll', handleWindowScroll)
})

// Internal nav items (those mapped to BewlyCat pages)
const internalNavItems = [
  { labelKey: 'topbar.nav_home', page: AppPage.Home },
  { labelKey: 'topbar.nav_anime', page: AppPage.Anime },
] as const

// External nav items (navigate same-tab to bilibili partition pages)
const externalNavItems = [
  { labelKey: 'topbar.nav_movie', url: 'https://www.bilibili.com/movie/', urlPattern: /^https?:\/\/(?:www\.)?bilibili\.com\/movie(\/|$)/i },
  // Game / Tech 兼容 B 站新旧分区路径：/v/game、/c/game、/c/Games 都能命中
  { labelKey: 'topbar.nav_game', url: 'https://www.bilibili.com/v/game/', urlPattern: /\/(?:v|c)\/games?(?:\/|$)/i },
  { labelKey: 'topbar.nav_tech', url: 'https://www.bilibili.com/v/tech/', urlPattern: /\/(?:v|c)\/tech(?:nology)?(?:\/|$)/i },
] as const

// Internal nav is only active when on the home page (bilibili.com/)
// — avoids false-positive active state on partition pages.
function isNavActive(page: AppPage): boolean {
  if (!isHomePage())
    return false
  return activatedPage.value === page
}

// 外部分类全是 same-tab 跳转 → 整页 reload → BewlyCat 重新挂载，
// currentHref 自然是新值。无需响应式跟踪 URL 变化，更不必 monkey-patch
// 全局 history（之前的 patch 在 B 站高频 pushState 场景下触发 reactive
// 风暴，是首页"loading 1 分钟"的根因）。
function isExternalNavActive(item: typeof externalNavItems[number]): boolean {
  return item.urlPattern.test(window.location.href)
}

function navigateTo(page: AppPage) {
  emit('navigate', page)
}

function openExternal(url: string) {
  window.location.href = url
}

function handleMyListNavigate(page: AppPage) {
  emit('navigate', page)
}

function handleOpenSettings() {
  emit('openSettings')
}
</script>

<template>
  <header class="netflix-topbar" :class="{ 'netflix-topbar--scrolled': isScrolled }">
    <div
      class="netflix-topbar__inner"
      max-w="$bew-page-max-width"
      flex="~ items-center gap-4"
      p="x-8"
      m-auto
      h="$bew-top-bar-height"
    >
      <!-- Left: BILIBILI wordmark -->
      <div class="netflix-topbar__left" flex="~ items-center gap-2" shrink-0>
        <a
          href="//www.bilibili.com"
          target="_top"
          class="netflix-wordmark"
          shrink-0
        >
          BILIBILI
        </a>
      </div>

      <!-- Nav items (紧靠 logo 左对齐) -->
      <nav class="netflix-topbar__nav" flex="~ items-center gap-2" shrink-0>
        <!-- Internal BewlyCat page nav items -->
        <button
          v-for="item in internalNavItems"
          :key="item.page"
          class="netflix-nav-item"
          :class="{ active: isNavActive(item.page) }"
          :style="isNavActive(item.page) ? { '--nav-underline-color': effectiveThemeColor } : {}"
          @click="navigateTo(item.page)"
        >
          {{ $t(item.labelKey) }}
        </button>

        <!-- External nav items -->
        <button
          v-for="item in externalNavItems"
          :key="item.url"
          class="netflix-nav-item"
          :class="{ active: isExternalNavActive(item) }"
          :style="isExternalNavActive(item) ? { '--nav-underline-color': effectiveThemeColor } : {}"
          @click="openExternal(item.url)"
        >
          {{ $t(item.labelKey) }}
        </button>

        <!-- My List dropdown -->
        <MyListMenu
          @navigate="handleMyListNavigate"
          @open-settings="handleOpenSettings"
        />
      </nav>

      <!-- Right: Search + TopBarRight (推到最右) -->
      <div class="netflix-topbar__right" flex="~ items-center gap-3" shrink-0 ml-auto>
        <!-- 固定宽度容器防止 TopBarSearch（flex:1 w-full）吞噬右侧剩余空间
             把头像等组件挤出可视区。小屏幕用更窄宽度避免溢出。 -->
        <div w="240px lg:280px" shrink-0>
          <TopBarSearch />
        </div>
        <TopBarRight
          :simplified="true"
          @notifications-click="handleNotificationsItemClick"
        />
      </div>
    </div>

    <!-- Notifications Drawer -->
    <KeepAlive v-if="settings.openNotificationsPageAsDrawer">
      <NotificationsDrawer
        v-if="topBarStore.drawerVisible.notifications"
        :url="topBarStore.notificationsDrawerUrl"
        @close="topBarStore.drawerVisible.notifications = false"
      />
    </KeepAlive>
  </header>
</template>

<style scoped lang="scss">
.netflix-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  width: 100%;
  /* 顶部置顶时：透明 + 自上而下渐变（黑→透明），让顶部文字可读但不挡 hero */
  background-color: transparent;
  background-image: linear-gradient(to bottom, rgba(20, 20, 20, 0.7) 0%, rgba(20, 20, 20, 0) 100%);
  /* 不用 border-bottom（1px transparent 边框在某些浏览器仍渲染出可见的细横线）。
     滚动后用 box-shadow 做下分割，不占布局空间 */
  border: 0;
  box-shadow: none;
  transition:
    background-color 0.25s ease,
    background-image 0.25s ease,
    box-shadow 0.25s ease;
}

/* 滚动超过阈值后：填纯色 + 显示极轻的下分隔阴影 */
.netflix-topbar--scrolled {
  background-color: var(--bew-bg);
  background-image: none;
  box-shadow: 0 1px 0 var(--bew-border-color, rgba(255, 255, 255, 0.08));
}

.netflix-topbar__inner {
  position: relative;
}

.netflix-wordmark {
  font-size: 1.75rem;
  font-weight: 900;
  color: var(--bew-theme-color);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  line-height: 1;
  transition:
    color 0.2s,
    letter-spacing 0.2s;
  user-select: none;

  &:hover {
    color: color-mix(in oklab, var(--bew-theme-color), white 20%);
    letter-spacing: 0.12em;
  }
}

.netflix-nav-item {
  position: relative;
  background: transparent;
  border: none;
  outline: none;
  padding: 0.5rem 0.85rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;
  transition:
    color 0.2s,
    background 0.2s;
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  &.active {
    color: #fff;

    &::after {
      content: "";
      position: absolute;
      bottom: -4px;
      left: 50%;
      transform: translateX(-50%);
      width: 70%;
      height: 2px;
      background-color: var(--nav-underline-color, var(--bew-theme-color));
      border-radius: 2px;
    }
  }
}
</style>
