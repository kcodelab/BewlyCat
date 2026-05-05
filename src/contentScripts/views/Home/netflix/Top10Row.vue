<!-- src/contentScripts/views/Home/netflix/Top10Row.vue -->
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Video } from '~/components/VideoCard/types'
import { useRankingData } from '~/contentScripts/views/Home/composables/useRankingData'

import HorizontalRow from './HorizontalRow.vue'

const { t } = useI18n()

// Use the default ranking type (all categories)
const defaultRankingType = { id: 1, name: '全站' }

const { items, loading, error, loadVideos } = useRankingData()

// Take first 10 items
const top10Items = computed<Video[]>(() => {
  return items.slice(0, 10).map(item => item.displayData).filter((v): v is Video => !!v)
})

onMounted(async () => {
  if (items.length === 0)
    await loadVideos(defaultRankingType)
})

function onRetry() {
  loadVideos(defaultRankingType)
}
</script>

<template>
  <!--
    Large rank number placeholder: each card's ::before is reserved for
    Task 8 to render true SVG rank numbers. CSS-only stub lives here.
  -->
  <HorizontalRow
    :title="t('home.top10_today')"
    :items="top10Items"
    :loading="loading"
    :error="error"
    class="top10-row"
    @retry="onRetry"
  />
</template>

<style scoped>
/* Reserve space for the large rank number. Task 8 fills this in with SVG. */
.top10-row :deep(.netflix-row__card-wrapper) {
  position: relative;
  padding-left: 1.5rem;
}

.top10-row :deep(.netflix-row__card-wrapper)::before {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  width: 1.5rem;
  height: 100%;
  background: transparent;
}
</style>
