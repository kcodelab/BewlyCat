<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import VideoCardGrid from '~/components/VideoCardGrid.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import type { GridLayoutType } from '~/logic'
import { settings } from '~/logic'

import type { VideoElement } from '../composables/useFollowingData'
import { calcTimeSince, useFollowingData } from '../composables/useFollowingData'

interface Props {
  gridLayout?: GridLayoutType
  topBarVisibility?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  gridLayout: 'adaptive',
  topBarVisibility: true,
})

const emit = defineEmits<{
  (e: 'beforeLoading'): void
  (e: 'afterLoading'): void
}>()

useI18n()

const { scrollViewportRef, handlePageRefresh } = useBewlyApp()
const {
  videoList,
  uploaderList,
  selectedUploader,
  isLoading,
  requestFailed,
  noMoreContent,
  needToLoginFirst,
  initData: composableInitData,
  selectUploader: composableSelectUploader,
  handleLoadMore: composableHandleLoadMore,
} = useFollowingData()

const shouldMoveAsideUp = ref<boolean>(false)
const searchKeyword = ref<string>('')

// Provide selectedUploader to child components for preview loading control
provide('moments-selected-uploader', selectedUploader)

// Watch topBarVisibility to control aside position
watch(() => props.topBarVisibility, () => {
  shouldMoveAsideUp.value = false
  if (settings.value.autoHideTopBar && settings.value.showTopBar) {
    if (props.topBarVisibility)
      shouldMoveAsideUp.value = false
    else
      shouldMoveAsideUp.value = true
  }
})

const unreadUploadersCount = computed(() => {
  return uploaderList.value.filter(uploader => uploader.hasUpdate).length
})

const displayedUploaderList = computed(() => {
  let list = uploaderList.value
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.trim().toLowerCase()
    list = list.filter(uploader => uploader.name.toLowerCase().includes(keyword))
  }
  return list
})

const gridKey = computed(() => `following-grid-${selectedUploader.value ?? 'all'}`)

function initData() {
  composableInitData(scrollViewportRef.value)
}

function selectUploader(mid: number | null) {
  composableSelectUploader(mid, scrollViewportRef.value)
}

async function handleLoadMore() {
  emit('beforeLoading')
  try {
    await composableHandleLoadMore()
  }
  finally {
    emit('afterLoading')
  }
}

onMounted(() => {
  initData()
  nextTick(() => {
    initPageAction()
  })
})

onActivated(() => {
  initPageAction()
})

function initPageAction() {
  handlePageRefresh.value = async () => {
    if (isLoading.value)
      return
    initData()
  }
}

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}

function transformVideoItem(item: VideoElement) {
  return item.displayData
}

defineExpose({ initData })
</script>

<template>
  <div flex="~ gap-40px">
    <!-- Left Panel: Uploader List -->
    <aside
      pos="sticky top-150px" h="[calc(100vh-140px)]" w-200px shrink-0 duration-300
      ease-in-out
      :class="{ hide: shouldMoveAsideUp }"
    >
      <div h-inherit p="x-20px b-20px t-8px" m--20px of-y-auto of-x-hidden>
        <!-- Search Box -->
        <div mb-3>
          <input
            v-model="searchKeyword"
            type="text"
            :placeholder="$t('common.search')"
            px-4 py-2 w-full
            rounded-lg
            bg="$bew-fill-1"
            border="1 $bew-border-color"
            text="sm $bew-text-1"
            outline-none
            transition="all 300"
            focus:border="$bew-theme-color"
            focus:bg="$bew-fill-2"
            placeholder:text="$bew-text-3"
          >
        </div>

        <TransitionGroup name="list" tag="ul" flex="~ col gap-2">
          <!-- All Uploaders Option -->
          <li key="all-uploaders">
            <a
              :class="{ active: selectedUploader === null }"
              px-4 py-2 hover:bg="$bew-fill-2" w-inherit
              block rounded-lg cursor-pointer transition="all 300 ease-out"
              hover:scale-105 un-text="$bew-text-1"
              flex="~ items-center gap-3"
              @click="selectUploader(null)"
            >
              <div
                w-30px h-30px rounded-full
                bg="$bew-fill-2" flex="~ items-center justify-center"
                shrink-0
              >
                <div i-mingcute:classify-2-fill text-lg />
              </div>
              <div flex-1 overflow-hidden>
                <div font-medium text-sm>
                  {{ $t('topbar.moments_dropdown.tabs.all') }}
                </div>
                <div v-if="unreadUploadersCount > 0" class="secondary-text">
                  {{ $t('home.uploaders_with_updates', { count: unreadUploadersCount }) }}
                </div>
              </div>
            </a>
          </li>

          <!-- Individual Uploaders -->
          <li v-for="uploader in displayedUploaderList" :key="uploader.mid">
            <a
              :class="{ active: selectedUploader === uploader.mid }"
              px-4 py-2 hover:bg="$bew-fill-2" w-inherit
              block rounded-lg cursor-pointer transition="all 300 ease-out"
              hover:scale-105 un-text="$bew-text-1"
              flex="~ items-center gap-3"
              @click="selectUploader(uploader.mid)"
            >
              <div pos="relative" shrink-0>
                <img
                  :src="`${uploader.face}@50w_50h`"
                  w-30px h-30px rounded-full object-cover
                  loading="lazy"
                  alt="Avatar"
                >
                <!-- Red dot for new updates -->
                <div
                  v-if="uploader.hasUpdate"
                  pos="absolute top-0 right-0"
                  w-8px h-8px rounded-full
                  bg="red-500" border="2 $bew-elevated"
                />
              </div>
              <div flex-1 overflow-hidden>
                <div font-medium truncate text-sm>
                  {{ uploader.name }}
                </div>
                <div class="secondary-text">
                  {{ calcTimeSince(uploader.lastUpdateTime) }}
                </div>
              </div>
            </a>
          </li>
        </TransitionGroup>
      </div>
    </aside>

    <!-- Right Panel: Video Feed -->
    <div w-full>
      <VideoCardGrid
        :key="gridKey"
        :items="videoList"
        :grid-layout="gridLayout"
        :loading="isLoading"
        :no-more-content="noMoreContent"
        :need-to-login-first="needToLoginFirst"
        :request-failed="requestFailed"
        :transform-item="transformVideoItem"
        :get-item-key="(item: VideoElement) => item.uniqueId"
        :show-watcher-later="false"
        is-following-page
        show-preview
        @refresh="initData"
        @login="jumpToLoginPage"
        @load-more="handleLoadMore"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.secondary-text {
  --uno: "text-xs text-$bew-text-2";
}

.active {
  --uno: "bg-$bew-theme-color-auto text-$bew-text-auto shadow-$bew-shadow-2";

  .secondary-text {
    --uno: "text-$bew-text-auto opacity-85";
  }
}

.hide {
  --uno: "h-[calc(100vh-70px)] translate-y--70px";
}

/* TransitionGroup 列表过渡效果 */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

/* 确保离开的元素从布局流中移除 */
.list-leave-active {
  position: absolute;
}
</style>
