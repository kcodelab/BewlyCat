<script setup lang="ts">
import { useBewlyApp } from '~/composables/useAppProvider'
import { useThemePack } from '~/composables/useThemePack'
import { AppPage } from '~/enums/appEnums'
import { settings } from '~/logic'
import { useTopBarStore } from '~/stores/topBarStore'

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

// Internal nav items (those mapped to BewlyCat pages)
const internalNavItems = [
  { labelKey: 'topbar.nav_home', page: AppPage.Home },
  { labelKey: 'topbar.nav_anime', page: AppPage.Anime },
] as const

// External nav items (open bilibili in new tab)
const externalNavItems = [
  { labelKey: 'topbar.nav_movie', url: 'https://www.bilibili.com/v/cinephile/movie/' },
  { labelKey: 'topbar.nav_game', url: 'https://www.bilibili.com/v/game/' },
  { labelKey: 'topbar.nav_tech', url: 'https://www.bilibili.com/v/tech/' },
] as const

function isNavActive(page: AppPage): boolean {
  return activatedPage.value === page
}

function navigateTo(page: AppPage) {
  emit('navigate', page)
}

function openExternal(url: string) {
  window.open(url, '_blank')
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
      <!-- Left: BiliBili logo -->
      <div class="netflix-topbar__left" flex="~ items-center gap-2" shrink-0>
        <a
          href="//www.bilibili.com"
          target="_top"
          class="netflix-logo"
          grid="~ place-items-center"
          rounded-full
          duration-300
          w-40px h-40px
          bg="hover:$bew-theme-color"
          shrink-0
        >
          <svg
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            width="30"
            height="30"
            :style="{
              fill: 'var(--bew-theme-color)',
              filter: 'drop-shadow(0 0 4px var(--bew-theme-color-60))',
            }"
          >
            <path d="M450.803484 456.506027l-120.670435 23.103715 10.333298 45.288107 119.454151-23.102578-9.117014-45.289244z m65.04448 120.060586c-29.483236 63.220622-55.926329 15.502222-55.926328 15.502223l-19.754098 12.768142s38.90176 53.192249 75.986489 12.764729c43.770311 40.42752 77.203911-13.068516 77.203911-13.068516l-17.934791-11.55072c0.001138-0.304924-31.305956 44.983182-59.575183-16.415858z m59.57632-74.773617L695.182222 524.895573l10.029511-45.288106-120.364373-23.103716-9.423076 45.289245z m237.784178-88.926436c-1.905778-84.362809-75.487004-100.540871-75.487004-100.540871s-57.408853-0.316302-131.944676-0.95232l54.237867-52.332089s8.562916-10.784996-6.026809-22.834062c-14.592-12.051342-15.543182-6.660551-20.615396-3.487289-4.441884 3.169849-69.462471 66.920676-80.878933 78.340551-29.494613 0-60.2624-0.319716-90.075591-0.319716h10.466418s-77.705671-76.754489-82.781298-80.241777c-5.075627-3.488427-5.709369-8.56064-20.616533 3.487289-14.589724 12.05248-6.026809 22.8352-6.026809 22.8352l55.504213 53.919288c-60.261262 0-112.280462 0.319716-136.383147 1.268623-78.025387 22.521173-71.99744 100.859449-71.99744 100.859449s0.950044 168.100978 0 253.103217c8.562916 85.00224 73.899804 98.636231 73.899805 98.636231s26.007324 0.63488 45.357511 0.63488c1.900089 5.391929 3.486151 32.034133 33.302756 32.034134 29.495751 0 33.30048-32.034133 33.30048-32.034134s217.263218-0.950044 235.340231-0.950044c0.953458 9.196658 5.394204 33.619058 35.207395 33.303893 29.494613-0.636018 31.714418-35.20512 31.714418-35.20512s10.151253-0.95232 40.280747 0c70.413653-13.005938 74.534684-95.468658 74.534684-95.468657s-1.265209-169.689316-0.312889-254.056676zM752.628622 681.8304c0 13.319964-10.467556 24.102684-23.471218 24.102684H300.980907c-13.003662 0-23.47008-10.78272-23.47008-24.102684V397.961671c0-13.32224 10.467556-24.106098 23.47008-24.106098h428.176497c13.003662 0 23.471218 10.783858 23.471218 24.106098v283.868729z" />
          </svg>
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
      <div class="netflix-topbar__right" flex="~ items-center gap-2" shrink-0>
        <TopBarSearch />
        <TopBarRight
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
  z-index: 999;
  width: 100%;
  background-color: var(--bew-bg);
  border-bottom: 1px solid var(--bew-border-color, rgba(255, 255, 255, 0.06));
}

.netflix-topbar__inner {
  position: relative;
}

.netflix-logo {
  svg {
    transition: fill 0.3s;
  }

  &:hover svg {
    fill: white !important;
    filter: none !important;
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
