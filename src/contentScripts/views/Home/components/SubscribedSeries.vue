<script setup lang="ts">
import VideoCardGrid from '~/components/VideoCardGrid.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import type { GridLayoutType } from '~/logic'

import { useSubscribedSeriesData } from '../composables/useSubscribedSeriesData'

const { gridLayout } = defineProps<{
  gridLayout: GridLayoutType
}>()

const emit = defineEmits<{
  (e: 'beforeLoading'): void
  (e: 'afterLoading'): void
}>()

const { items: videoList, loading: isLoading, needToLoginFirst, noMoreContent, noMoreContentWarning, load, initLoad } = useSubscribedSeriesData()
const { handleReachBottom, handlePageRefresh } = useBewlyApp()

onMounted(() => {
  initData()
  initPageAction()
})

onActivated(() => {
  initPageAction()
})

async function initData() {
  emit('beforeLoading')
  try {
    await initLoad()
  }
  finally {
    emit('afterLoading')
  }
}

function initPageAction() {
  handleReachBottom.value = async () => {
    if (isLoading.value)
      return
    if (noMoreContent.value) {
      noMoreContentWarning.value = true
      return
    }
    handleLoadMore()
  }
  handlePageRefresh.value = async () => {
    if (isLoading.value)
      return

    initData()
  }
}

// 供 VideoCardGrid 预加载调用的函数
async function handleLoadMore() {
  if (isLoading.value || noMoreContent.value)
    return

  await load()
}

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}

defineExpose({ initData })
</script>

<template>
  <div>
    <VideoCardGrid
      :items="videoList"
      :grid-layout="gridLayout"
      :loading="isLoading"
      :no-more-content="noMoreContentWarning"
      :need-to-login-first="needToLoginFirst"
      :transform-item="(item: any) => item.displayData"
      :get-item-key="(item: any) => item.uniqueId"
      video-type="bangumi"
      :show-watcher-later="false"
      @refresh="initData"
      @login="jumpToLoginPage"
      @load-more="handleLoadMore"
    />
  </div>
</template>
