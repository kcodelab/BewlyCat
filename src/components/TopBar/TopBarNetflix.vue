<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import { useBewlyApp } from '~/composables/useAppProvider'
import { useThemePack } from '~/composables/useThemePack'
import { AppPage } from '~/enums/appEnums'
import { settings } from '~/logic'
import { useTopBarStore } from '~/stores/topBarStore'
import { isHomePage } from '~/utils/main'

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

// Reactive current href: B 站 client-side router can change URL after mount
// (e.g. /v/game/ → /v/game-center/featured)，window.location.href 不是响应式的，
// 必须手动监听 popstate/pushstate/replaceState 同步到 ref 才能让 :class 重算。
const currentHref = ref(window.location.href)

function syncHref() {
  currentHref.value = window.location.href
}

function patchHistory() {
  const orig = { push: history.pushState, replace: history.replaceState }
  history.pushState = function (...args) {
    const r = orig.push.apply(this, args)
    window.dispatchEvent(new Event('bewly-locationchange'))
    return r
  }
  history.replaceState = function (...args) {
    const r = orig.replace.apply(this, args)
    window.dispatchEvent(new Event('bewly-locationchange'))
    return r
  }
  return () => {
    history.pushState = orig.push
    history.replaceState = orig.replace
  }
}

let restoreHistory: (() => void) | null = null
onMounted(() => {
  window.addEventListener('popstate', syncHref)
  window.addEventListener('hashchange', syncHref)
  window.addEventListener('bewly-locationchange', syncHref)
  restoreHistory = patchHistory()
})

onUnmounted(() => {
  window.removeEventListener('popstate', syncHref)
  window.removeEventListener('hashchange', syncHref)
  window.removeEventListener('bewly-locationchange', syncHref)
  restoreHistory?.()
})

function isExternalNavActive(item: typeof externalNavItems[number]): boolean {
  return item.urlPattern.test(currentHref.value)
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
  <header class="netflix-topbar">
    <div
      class="netflix-topbar__inner"
      max-w="$bew-page-max-width"
      flex="~ items-center justify-between gap-4"
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

      <!-- Center: Nav items -->
      <nav class="netflix-topbar__nav" flex="~ items-center gap-1" shrink-0>
        <!-- Internal BewlyCat page nav items -->
        <button
          v-for="item in internalNavItems"
          :key="item.page"
          class="netflix-nav-item"
          :class="{ active: isNavActive(item.page) }"
          :style="isNavActive(item.page) ? { '--nav-underline-color': effectiveThemeColor } : {}"
          px-3 py-2
          text="$bew-text-1 sm"
          fw-semibold
          cursor-pointer
          duration-200
          rounded-md
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
          px-3 py-2
          text="$bew-text-1 sm"
          fw-semibold
          cursor-pointer
          duration-200
          rounded-md
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

      <!-- Right: Search + TopBarRight -->
      <div class="netflix-topbar__right" flex="~ items-center gap-3" shrink-0>
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
  background-color: var(--bew-bg);
  border-bottom: 1px solid var(--bew-border-color, rgba(255, 255, 255, 0.06));
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
  color: var(--bew-text-1);

  &:hover {
    background: var(--bew-fill-2);
    color: var(--bew-text-1);
  }

  &.active {
    &::after {
      content: "";
      position: absolute;
      bottom: -2px;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      height: 2px;
      background-color: var(--nav-underline-color, var(--bew-theme-color));
      border-radius: 2px;
    }
  }
}
</style>
