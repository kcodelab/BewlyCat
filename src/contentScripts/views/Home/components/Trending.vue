<script setup lang="ts">
import VideoCardGrid from '~/components/VideoCardGrid.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import type { GridLayoutType } from '~/logic'

import { useTrendingData } from '../composables/useTrendingData'

const { gridLayout } = defineProps<{
  gridLayout: GridLayoutType
}>()

const emit = defineEmits<{
  (e: 'beforeLoading'): void
  (e: 'afterLoading'): void
}>()

const { items: videoList, loading: isLoading, noMoreContent, initLoad, load } = useTrendingData()
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
    if (!isLoading.value && !noMoreContent.value)
      handleLoadMore()
  }

  handlePageRefresh.value = async () => {
    initData()
  }
}

// 供 VideoCardGrid 预加载调用的函数
async function handleLoadMore() {
  if (isLoading.value || noMoreContent.value)
    return

  await load()
}

defineExpose({ initData })
</script>

<template>
  <VideoCardGrid
    :items="videoList"
    :grid-layout="gridLayout"
    :loading="isLoading"
    :no-more-content="noMoreContent"
    :transform-item="(item: any) => item.displayData"
    :get-item-key="(item: any) => item.uniqueId"
    show-preview
    @refresh="initData"
    @load-more="handleLoadMore"
  />
</template>
