<script setup lang="ts">
import { ref } from 'vue'

import { AppPage } from '~/enums/appEnums'

const emit = defineEmits<{
  (e: 'navigate', page: AppPage): void
  (e: 'openSettings'): void
}>()

const isOpen = ref(false)
let enterTimer: ReturnType<typeof setTimeout> | null = null
let leaveTimer: ReturnType<typeof setTimeout> | null = null

function onEnter() {
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = null
  }
  enterTimer = setTimeout(() => {
    isOpen.value = true
  }, 150)
}

function onLeave() {
  if (enterTimer) {
    clearTimeout(enterTimer)
    enterTimer = null
  }
  leaveTimer = setTimeout(() => {
    isOpen.value = false
  }, 200)
}

function handleNavigate(page: AppPage) {
  isOpen.value = false
  emit('navigate', page)
}

function handleOpenSettings() {
  isOpen.value = false
  emit('openSettings')
}

const menuItems = [
  {
    key: 'favorites',
    icon: 'i-mingcute:star-line',
    labelKey: 'topbar.my_list_favorites',
    page: AppPage.Favorites,
    action: () => handleNavigate(AppPage.Favorites),
  },
  {
    key: 'watchLater',
    icon: 'i-mingcute:carplay-line',
    labelKey: 'topbar.my_list_watchlater',
    page: AppPage.WatchLater,
    action: () => handleNavigate(AppPage.WatchLater),
  },
  {
    key: 'bangumi',
    icon: 'i-mingcute:tv-2-line',
    labelKey: 'topbar.my_list_bangumi',
    page: null,
    action: () => {
      isOpen.value = false
      window.open('https://www.bilibili.com/anime/timeline/', '_blank')
    },
  },
  {
    key: 'moments',
    icon: 'i-tabler:windmill',
    labelKey: 'topbar.my_list_moments',
    page: AppPage.Moments,
    action: () => handleNavigate(AppPage.Moments),
  },
  {
    key: 'history',
    icon: 'i-mingcute:time-line',
    labelKey: 'topbar.my_list_history',
    page: AppPage.History,
    action: () => handleNavigate(AppPage.History),
  },
  {
    key: 'settings',
    icon: 'i-mingcute:settings-3-line',
    labelKey: 'topbar.my_list_settings',
    page: null,
    action: () => handleOpenSettings(),
  },
] as const
</script>

<template>
  <div
    class="my-list-menu"
    pos="relative"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <!-- Trigger button -->
    <button
      class="my-list-trigger"
      flex="~ items-center gap-1"
      px-3 py-1
      rounded-md
      text="$bew-text-1 sm"
      fw-semibold
      cursor-pointer
      duration-200
      :class="{ open: isOpen }"
    >
      {{ $t('topbar.my_list') }}
      <div
        class="i-mingcute:down-line"
        text-xs
        duration-200
        :style="{ transform: isOpen ? 'rotate(-180deg)' : 'rotate(0deg)' }"
      />
    </button>

    <!-- Dropdown panel -->
    <Transition name="my-list-drop">
      <div
        v-if="isOpen"
        class="my-list-panel"
        pos="absolute top-full left-0"
        mt-2
        min-w="160px"
        rounded-lg
        border="1 $bew-border-color"
        overflow-hidden
        z-1000
        py-1
        :style="{
          background: 'var(--bew-content-alt)',
          backdropFilter: 'var(--bew-filter-glass-1)',
          boxShadow: 'var(--bew-shadow-2)',
        }"
      >
        <button
          v-for="item in menuItems"
          :key="item.key"
          class="my-list-item"
          flex="~ items-center gap-3"
          w-full px-4 py-2
          text="$bew-text-1 sm left"
          cursor-pointer
          duration-150
          @click="item.action()"
        >
          <div :class="item.icon" text-base shrink-0 />
          <span>{{ $t(item.labelKey) }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.my-list-trigger {
  background: transparent;
  border: none;
  outline: none;
  color: var(--bew-text-1);

  &:hover,
  &.open {
    color: var(--bew-text-1);
    background: var(--bew-fill-2);
  }
}

.my-list-item {
  background: transparent;
  border: none;
  outline: none;

  &:hover {
    background: var(--bew-fill-2);
    color: var(--bew-text-1);
  }
}

.my-list-drop-enter-active,
.my-list-drop-leave-active {
  transition:
    opacity 150ms ease,
    transform 150ms ease;
  transform-origin: top left;
}

.my-list-drop-enter-from,
.my-list-drop-leave-to {
  opacity: 0;
  transform: scaleY(0.92) translateY(-4px);
}
</style>
