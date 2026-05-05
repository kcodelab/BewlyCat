<!-- src/contentScripts/views/Home/netflix/ContinueWatchingRow.vue -->
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Video } from '~/components/VideoCard/types'
import { useHistoryData } from '~/contentScripts/views/Home/composables/useHistoryData'

import HorizontalRow from './HorizontalRow.vue'

const { t } = useI18n()

const { items, loading, error, load } = useHistoryData()

// Map history items to VideoCard-compatible Video objects
const mappedItems = computed<Video[]>(() => {
  return items.value.map((item) => {
    return {
      id: item.history?.oid ?? 0,
      title: item.title ?? '',
      cover: item.cover ?? '',
      bvid: item.history?.bvid ?? '',
      duration: item.duration,
      author: item.author_name
        ? {
            name: item.author_name,
            authorFace: item.author_face ?? '',
            mid: item.author_mid ?? 0,
          }
        : undefined,
      threePointV2: [],
    }
  })
})

onMounted(async () => {
  if (items.value.length === 0)
    await load()
})

function onRetry() {
  load()
}
</script>

<template>
  <!--
    Progress bar placeholder: each card in this row has a ::after reserved for
    Task 8 to render true progress. CSS-only stub lives in HorizontalRow item.
  -->
  <HorizontalRow
    :title="t('home.continue_watching')"
    :items="mappedItems"
    :loading="loading"
    :error="error"
    class="continue-watching-row"
    @retry="onRetry"
  />
</template>

<style scoped>
/* Reserve progress bar slot at the bottom of each card. Task 8 fills this in. */
.continue-watching-row :deep(.netflix-row__card-wrapper)::after {
  content: "";
  display: block;
  height: 3px;
  background: transparent;
  margin-top: 2px;
}
</style>
