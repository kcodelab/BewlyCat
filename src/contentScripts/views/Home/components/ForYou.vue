<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'

import VideoCardGrid from '~/components/VideoCardGrid.vue'
import { UndoForwardState, useBewlyApp } from '~/composables/useAppProvider'
import type { GridLayoutType } from '~/logic'
import { settings } from '~/logic'
import type { Item as AppVideoItem } from '~/models/video/appForYou'
import { Type as ThreePointV2Type } from '~/models/video/appForYou'
import type { AppVideoElement, VideoElement } from '~/stores/forYouStore'
import { useForYouStore } from '~/stores/forYouStore'

import { useForYouData } from '../composables/useForYouData'

const { gridLayout } = defineProps<{
  gridLayout: GridLayoutType
}>()

const emit = defineEmits<{
  (e: 'beforeLoading'): void
  (e: 'afterLoading'): void
}>()

const forYouStore = useForYouStore()

const {
  videoList,
  appVideoList,
  isLoading,
  requestFailed,
  needToLoginFirst,
  noMoreContent,
  refreshIdx,
  consecutiveEmptyLoads,
  appConsecutiveEmptyLoads,
  isRecursiveLoading,
  scrollLoadStartLength,
  APP_LOAD_BATCHES,
  getData,
  initData: composableInitData,
} = useForYouData()

const { handleReachBottom, handlePageRefresh, undoForwardState, handleUndoRefresh, handleForwardRefresh, handleBackToTop, scrollViewportRef } = useBewlyApp()

// 当前使用的视频列表（根据推荐模式）
const currentVideoList = computed(() =>
  settings.value.recommendationMode === 'web' ? videoList.value : appVideoList.value,
)

const activatedAppVideo = ref<AppVideoItem | null>()
const showDislikeDialog = ref<boolean>(false)
const isPageVisible = ref<boolean>(!document.hidden)
const selectedDislikeReason = ref<number>(1)

// 修改缓存数据变量，添加前进状态变量（组件级 UI 状态，不抽入 composable）
const cachedVideoList = ref<VideoElement[]>([])
const cachedRefreshIdx = ref<number>(1)
const forwardVideoList = ref<VideoElement[]>([])
const forwardRefreshIdx = ref<number>(1)
const cachedAppVideoList = ref<AppVideoElement[]>([])
const forwardAppVideoList = ref<AppVideoElement[]>([])
const hasBackState = ref<boolean>(false)
const hasForwardState = ref<boolean>(false)

// 监听页面可见性变化
function handleVisibilityChange() {
  isPageVisible.value = !document.hidden
}

// 添加页面可见性监听器
onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 如果启用状态保留且store中有数据，则恢复状态
  if (settings.value.preserveForYouState && forYouStore.state.isInitialized) {
    // 恢复关键状态
    const savedState = forYouStore.getCompleteState()
    videoList.value = [...savedState.videoList]
    appVideoList.value = [...savedState.appVideoList]
    refreshIdx.value = savedState.refreshIdx
    noMoreContent.value = savedState.noMoreContent

    // 确保撤销按钮不显示（因为这是状态恢复，不是刷新操作）
    hasBackState.value = false
    hasForwardState.value = false
    undoForwardState.value = UndoForwardState.Hidden

    // 清空所有缓存状态，确保没有历史数据影响
    cachedVideoList.value = []
    cachedRefreshIdx.value = 1
    forwardVideoList.value = []
    forwardRefreshIdx.value = 1

    // 恢复滚动位置
    if (savedState.scrollTop) {
      nextTick(() => {
        const viewport = scrollViewportRef.value
        if (viewport)
          viewport.scrollTop = savedState.scrollTop || 0
      })
    }

    // 延迟初始化页面交互功能，避免立即触发数据加载
    setTimeout(() => {
      initPageAction()
      // 在初始化页面交互功能后，再次确保按钮状态正确
      setTimeout(() => {
        if (settings.value.preserveForYouState && forYouStore.state.isInitialized) {
          undoForwardState.value = UndoForwardState.Hidden
        }
      }, 100)
    }, 1000)
  }
  else {
    // 首次加载或未启用状态保留时，初始化数据
    setTimeout(() => {
      initData()
    }, 200)
    initPageAction()
  }
})

onActivated(() => {
  initPageAction()
})

onBeforeUnmount(() => {
  // 如果启用状态保留，保存当前状态到store
  if (settings.value.preserveForYouState) {
    // 获取当前滚动位置
    const scrollTop = scrollViewportRef.value?.scrollTop || 0

    const currentState = {
      videoList: [...videoList.value],
      appVideoList: [...appVideoList.value],
      refreshIdx: refreshIdx.value,
      noMoreContent: noMoreContent.value,
      isInitialized: true,
      scrollTop, // 保存滚动位置
    }
    forYouStore.saveCompleteState(currentState)
  }
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

onKeyStroke((e: KeyboardEvent) => {
  if (showDislikeDialog.value) {
    const dislikeReasons = activatedAppVideo.value?.three_point_v2?.find(option => option.type === ThreePointV2Type.Dislike)?.reasons || []

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      dislikeReasons.forEach((reason) => {
        if (dislikeReasons[Number(e.key) - 1] && reason.id === dislikeReasons[Number(e.key) - 1].id)
          selectedDislikeReason.value = reason.id
      })
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const currentIndex = dislikeReasons.findIndex(reason => selectedDislikeReason.value === reason.id)
      if (currentIndex > 0)
        selectedDislikeReason.value = dislikeReasons[currentIndex - 1].id
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const currentIndex = dislikeReasons.findIndex(reason => selectedDislikeReason.value === reason.id)
      if (currentIndex < dislikeReasons.length - 1)
        selectedDislikeReason.value = dislikeReasons[currentIndex + 1].id
    }
  }
})

watch(() => settings.value.recommendationMode, () => {
  noMoreContent.value = false
  refreshIdx.value = 1
  consecutiveEmptyLoads.value = 0
  appConsecutiveEmptyLoads.value = 0

  videoList.value = []
  appVideoList.value = []
  forwardVideoList.value = []
  cachedVideoList.value = []
  forwardAppVideoList.value = []
  cachedAppVideoList.value = []

  // 重置前进后退状态
  hasBackState.value = false
  hasForwardState.value = false
  undoForwardState.value = UndoForwardState.Hidden

  // 重置store状态
  forYouStore.resetState()

  initData()
})

async function initData() {
  // 直接清空列表，骨架屏由 VideoCardGrid 自动处理
  emit('beforeLoading')
  try {
    await composableInitData()
  }
  finally {
    emit('afterLoading')
  }
}

async function internalGetData() {
  emit('beforeLoading')
  try {
    await getData()
  }
  finally {
    emit('afterLoading')
  }
}

// 供 VideoCardGrid 预加载调用的函数
function handleLoadMore() {
  // 如果正在递归加载中，跳过外部触发的加载请求
  if (isLoading.value || noMoreContent.value || isRecursiveLoading.value)
    return

  // 滚动加载时，APP模式记录开始长度，触发持续加载
  if (settings.value.recommendationMode === 'app') {
    APP_LOAD_BATCHES.value = 1
    scrollLoadStartLength.value = appVideoList.value.length
  }

  internalGetData()
}

function initPageAction() {
  handleReachBottom.value = async () => {
    if (isLoading.value)
      return
    if (noMoreContent.value)
      return

    handleLoadMore()
  }

  handlePageRefresh.value = async () => {
    if (isLoading.value)
      return

    // 根据当前模式保存数据
    if (settings.value.recommendationMode === 'web') {
      // 总是保存刷新前的当前状态到后退缓存
      cachedVideoList.value = JSON.parse(JSON.stringify(videoList.value))
      cachedRefreshIdx.value = refreshIdx.value
      hasBackState.value = true

      // 清空前进状态（因为刷新会产生新的分支）
      forwardVideoList.value = []
      hasForwardState.value = false

      // 显示撤销按钮
      undoForwardState.value = UndoForwardState.ShowUndo
    }
    else if (settings.value.recommendationMode === 'app') {
      // APP 模式下保存刷新前的当前状态到后退缓存
      cachedAppVideoList.value = JSON.parse(JSON.stringify(appVideoList.value))
      hasBackState.value = true

      // 清空前进状态（因为刷新会产生新的分支）
      forwardAppVideoList.value = []
      hasForwardState.value = false

      // 显示撤销按钮
      undoForwardState.value = UndoForwardState.ShowUndo
    }

    initData()
  }

  // 修改撤销刷新的处理函数
  handleUndoRefresh.value = () => {
    if (hasBackState.value) {
      if (settings.value.recommendationMode === 'web' && cachedVideoList.value.length > 0) {
        // 滚动到页面顶部
        handleBackToTop()

        // Web模式下的后退操作
        // 保存当前数据到前进状态
        forwardVideoList.value = JSON.parse(JSON.stringify(videoList.value))
        forwardRefreshIdx.value = refreshIdx.value
        hasForwardState.value = true

        // 恢复缓存的数据
        videoList.value = JSON.parse(JSON.stringify(cachedVideoList.value))
        refreshIdx.value = cachedRefreshIdx.value

        hasBackState.value = false
        undoForwardState.value = UndoForwardState.Hidden
        consecutiveEmptyLoads.value = 0 // 重置空加载计数器
      }
      else if (settings.value.recommendationMode === 'app' && cachedAppVideoList.value.length > 0) {
        // 滚动到页面顶部
        handleBackToTop()

        // APP模式下的后退操作
        // 保存当前数据到前进状态
        forwardAppVideoList.value = JSON.parse(JSON.stringify(appVideoList.value))
        hasForwardState.value = true

        // 恢复缓存的数据
        appVideoList.value = JSON.parse(JSON.stringify(cachedAppVideoList.value))

        hasBackState.value = false
        undoForwardState.value = UndoForwardState.Hidden
        appConsecutiveEmptyLoads.value = 0 // 重置APP模式空加载计数器
      }
    }
  }

  // 添加前进功能
  handleForwardRefresh.value = () => {
    if (hasForwardState.value) {
      if (settings.value.recommendationMode === 'web' && forwardVideoList.value.length > 0) {
        // 滚动到页面顶部
        handleBackToTop()

        // Web模式下的前进操作
        // 保存当前数据到后退状态
        cachedVideoList.value = JSON.parse(JSON.stringify(videoList.value))
        cachedRefreshIdx.value = refreshIdx.value
        hasBackState.value = true

        // 恢复前进状态的数据
        videoList.value = JSON.parse(JSON.stringify(forwardVideoList.value))
        refreshIdx.value = forwardRefreshIdx.value

        // 标记为已经前进
        hasForwardState.value = false
        undoForwardState.value = UndoForwardState.ShowUndo
        consecutiveEmptyLoads.value = 0 // 重置空加载计数器
        return true
      }
      else if (settings.value.recommendationMode === 'app' && forwardAppVideoList.value.length > 0) {
        // 滚动到页面顶部
        handleBackToTop()

        // APP模式下的前进操作
        // 保存当前数据到后退状态
        cachedAppVideoList.value = JSON.parse(JSON.stringify(appVideoList.value))
        hasBackState.value = true

        // 恢复前进状态的数据
        appVideoList.value = JSON.parse(JSON.stringify(forwardAppVideoList.value))

        // 标记为已经前进
        hasForwardState.value = false
        undoForwardState.value = UndoForwardState.ShowUndo
        appConsecutiveEmptyLoads.value = 0 // 重置APP模式空加载计数器
        return true
      }
    }
    return false
  }
}

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}

// 修改 defineExpose，暴露重置方法和撤销方法
defineExpose({
  initData,
  undoRefresh: () => {
    handleUndoRefresh.value?.()
  },
  goForward: () => {
    handleForwardRefresh.value?.()
  },
  canGoBack: () => {
    if (settings.value.recommendationMode === 'web')
      return hasBackState.value && cachedVideoList.value.length > 0
    else if (settings.value.recommendationMode === 'app')
      return hasBackState.value && cachedAppVideoList.value.length > 0
    return false
  },
  canGoForward: () => {
    if (settings.value.recommendationMode === 'web')
      return hasForwardState.value && forwardVideoList.value.length > 0
    else if (settings.value.recommendationMode === 'app')
      return hasForwardState.value && forwardAppVideoList.value.length > 0
    return false
  },
})
</script>

<template>
  <div>
    <VideoCardGrid
      v-if="!needToLoginFirst"
      :items="currentVideoList"
      :grid-layout="gridLayout"
      :loading="isLoading"
      :no-more-content="noMoreContent"
      :need-to-login-first="needToLoginFirst"
      :request-failed="requestFailed"
      :transform-item="(item: VideoElement | AppVideoElement) => item.displayData"
      :get-item-key="(item: VideoElement | AppVideoElement, index?: number) => `${item.uniqueId}-${index ?? 0}`"
      :video-type="settings.recommendationMode === 'web' ? 'rcmd' : 'appRcmd'"
      show-preview
      more-btn
      @refresh="initData"
      @login="jumpToLoginPage"
      @load-more="handleLoadMore"
    />

    <Empty v-if="needToLoginFirst" mt-6 :description="$t('common.please_log_in_first')">
      <Button type="primary" @click="jumpToLoginPage()">
        {{ $t('common.login') }}
      </Button>
    </Empty>
  </div>
</template>

<style lang="scss" scoped>
/* Styles moved to VideoCardGrid component */
</style>
