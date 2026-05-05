<script setup lang="ts">
import VideoCardGrid from '~/components/VideoCardGrid.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import type { GridLayoutType } from '~/logic'

import { usePreciousData } from '../composables/usePreciousData'

defineProps<{
  gridLayout: GridLayoutType
}>()

const emit = defineEmits<{
  (e: 'beforeLoading'): void
  (e: 'afterLoading'): void
}>()

const { items: videoList, loading: isLoading, initLoad } = usePreciousData()
const noMoreContent = ref<boolean>(true) // 入站必刷没有分页
const { handlePageRefresh } = useBewlyApp()

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
  handlePageRefresh.value = async () => {
    initData()
  }
}

defineExpose({ initData })
</script>

<template>
  <div>
    <VideoCardGrid
      :items="videoList"
      :grid-layout="gridLayout"
      :loading="isLoading"
      :no-more-content="noMoreContent"
      :transform-item="(item: any) => item.displayData"
      :get-item-key="(item: any) => item.uniqueId"
      :is-skeleton-item="(item: any) => !item.item"
      show-preview
      @refresh="initData"
      @load-more="() => {}"
    />
  </div>
</template>
