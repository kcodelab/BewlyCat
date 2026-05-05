<script setup lang="ts">
import VideoCardGrid from '~/components/VideoCardGrid.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import type { GridLayoutType } from '~/logic'

import { useLiveData } from '../composables/useLiveData'

const { gridLayout } = defineProps<{
  gridLayout: GridLayoutType
}>()

const emit = defineEmits<{
  (e: 'beforeLoading'): void
  (e: 'afterLoading'): void
}>()

const { items: videoList, loading: isLoading, needToLoginFirst, noMoreContent, load, initLoad } = useLiveData()
const { handleReachBottom, handlePageRefresh } = useBewlyApp()

onMounted(() => {
  initData()
  initPageAction()
})

onActivated(() => {
  initPageAction()
})

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

    initData()
  }
}

async function initData() {
  emit('beforeLoading')
  try {
    await initLoad()
  }
  finally {
    emit('afterLoading')
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
  <VideoCardGrid
    :items="videoList"
    :grid-layout="gridLayout"
    :loading="isLoading"
    :no-more-content="noMoreContent"
    :need-to-login-first="needToLoginFirst"
    :transform-item="(item: any) => item.displayData"
    :get-item-key="(item: any) => item.uniqueId"
    :show-watcher-later="false"
    show-preview
    @refresh="initData"
    @login="jumpToLoginPage"
    @load-more="handleLoadMore"
  />
</template>
