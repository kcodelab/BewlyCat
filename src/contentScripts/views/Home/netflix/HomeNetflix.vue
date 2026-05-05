<!-- src/contentScripts/views/Home/netflix/HomeNetflix.vue -->
<!-- pickHeroCandidate is a named export from ./heroUtils.ts (pure TS, importable in tests). -->
<script setup lang="ts">
import { computed, onMounted, provide, ref } from 'vue'

import { settings } from '~/logic'

import { useFollowingData } from '../composables/useFollowingData'
import { useForYouData } from '../composables/useForYouData'
import { buildNetflixHomeRows } from '../composables/useHomeRowRegistry'
import { useLiveData } from '../composables/useLiveData'
import { usePreciousData } from '../composables/usePreciousData'
import { useSubscribedSeriesData } from '../composables/useSubscribedSeriesData'
import { useTrendingData } from '../composables/useTrendingData'
import { useWeeklyData } from '../composables/useWeeklyData'
import { HomeSubPage } from '../types'
import ContinueWatchingRow from './ContinueWatchingRow.vue'
import HeroBanner from './HeroBanner.vue'
import { pickHeroCandidates } from './heroUtils'
import HorizontalRow from './HorizontalRow.vue'
import Top10Row from './Top10Row.vue'

// ── Data sources ──────────────────────────────────────────────────
const trending = useTrendingData()
const forYou = useForYouData()
const following = useFollowingData()
const subscribedSeries = useSubscribedSeriesData()
const weekly = useWeeklyData()
const live = useLiveData()
const precious = usePreciousData()

// ── Hero selection ─────────────────────────────────────────────────
const heroVideos = computed(() => {
  const trendingVideos = trending.items.value.map(el => el.displayData).filter(Boolean) as any[]
  const forYouVideos = forYou.videoList.value.map(el => el.displayData).filter(Boolean) as any[]
  return pickHeroCandidates(trendingVideos, forYouVideos, 3)
})

// ── Row registry ───────────────────────────────────────────────────
const rows = computed(() => {
  const visibility = (settings.value.homePageTabVisibilityList ?? []).filter(
    // Exclude Ranking — it's covered by Top10Row
    v => v.page !== HomeSubPage.Ranking,
  )
  return buildNetflixHomeRows(visibility)
})

// ── Per-subpage data lookup ────────────────────────────────────────
function getRowData(page: HomeSubPage): { items: any[], loading: boolean, error: Error | null } {
  switch (page) {
    case HomeSubPage.ForYou:
      return {
        items: forYou.videoList.value.map(el => el.displayData).filter(Boolean),
        loading: forYou.isLoading.value,
        error: forYou.error.value,
      }
    case HomeSubPage.Trending:
      return {
        items: trending.items.value.map(el => el.displayData).filter(Boolean),
        loading: trending.loading.value,
        error: trending.error.value,
      }
    case HomeSubPage.Following:
      return {
        items: following.videoList.value.map(el => el.displayData).filter(Boolean),
        loading: following.isLoading.value,
        error: following.error.value,
      }
    case HomeSubPage.SubscribedSeries:
      return {
        items: subscribedSeries.items.value.map(el => el.displayData).filter(Boolean),
        loading: subscribedSeries.loading.value,
        error: subscribedSeries.error.value,
      }
    case HomeSubPage.Weekly:
      return {
        items: weekly.items.value.map(el => el.displayData).filter(Boolean),
        loading: weekly.loading.value,
        error: weekly.error.value,
      }
    case HomeSubPage.Live:
      return {
        items: live.items.value.map(el => el.displayData).filter(Boolean),
        loading: live.loading.value,
        error: live.error.value,
      }
    case HomeSubPage.Precious:
      return {
        items: precious.items.value.map(el => el.displayData).filter(Boolean),
        loading: precious.loading.value,
        error: precious.error.value,
      }
    default:
      return { items: [], loading: false, error: null }
  }
}

function getRowTitle(page: HomeSubPage): string {
  const keyMap: Record<HomeSubPage, string> = {
    [HomeSubPage.ForYou]: '个性推荐',
    [HomeSubPage.Trending]: '热门视频',
    [HomeSubPage.Following]: '正在关注',
    [HomeSubPage.SubscribedSeries]: '订阅剧集',
    [HomeSubPage.Weekly]: '每周必看',
    [HomeSubPage.Live]: '直播',
    [HomeSubPage.Precious]: '入站必刷',
    [HomeSubPage.Ranking]: '排行',
  }
  return keyMap[page] ?? page
}

function handleRowRetry(page: HomeSubPage) {
  switch (page) {
    case HomeSubPage.ForYou:
      forYou.getData()
      break
    case HomeSubPage.Trending:
      trending.load()
      break
    case HomeSubPage.SubscribedSeries:
      subscribedSeries.load()
      break
    case HomeSubPage.Weekly:
      weekly.initLoad()
      break
    case HomeSubPage.Live:
      live.load()
      break
    case HomeSubPage.Precious:
      precious.load()
      break
    case HomeSubPage.Following:
      following.initData()
      break
  }
}

// ── Hover-target ref for VideoCardHover Teleport (决议 #4) ────────
const hoverTargetRef = ref<HTMLElement | null>(null)
provide('netflix-hover-target', hoverTargetRef)

// ── Mount: trigger data loads ──────────────────────────────────────
onMounted(async () => {
  // Hero data sources
  if (trending.items.value.length === 0)
    trending.load()
  if (forYou.videoList.value.length === 0)
    forYou.getData()

  // SubPage rows — load each visible subpage
  const visiblePages = (settings.value.homePageTabVisibilityList ?? [])
    .filter(v => v.visible && v.page !== HomeSubPage.Ranking)
    .map(v => v.page)

  for (const page of visiblePages) {
    switch (page) {
      case HomeSubPage.Following:
        if (following.videoList.value.length === 0)
          following.initData()
        break
      case HomeSubPage.SubscribedSeries:
        if (subscribedSeries.items.value.length === 0)
          subscribedSeries.load()
        break
      case HomeSubPage.Weekly:
        if (weekly.items.value.length === 0)
          weekly.initLoad()
        break
      case HomeSubPage.Live:
        if (live.items.value.length === 0)
          live.load()
        break
      case HomeSubPage.Precious:
        if (precious.items.value.length === 0)
          precious.load()
        break
    }
  }
})
</script>

<template>
  <div ref="hoverTargetRef" class="netflix-home" style="position: relative;">
    <!-- Hero Banner -->
    <HeroBanner :videos="heroVideos" />

    <!-- Continue Watching Row -->
    <ContinueWatchingRow />

    <!-- Top 10 Row -->
    <Top10Row />

    <!-- Dynamic SubPage Rows -->
    <template v-for="row in rows" :key="row.key">
      <HorizontalRow
        v-if="row.kind === 'subpage'"
        :title="getRowTitle(row.page)"
        :items="getRowData(row.page).items"
        :loading="getRowData(row.page).loading"
        :error="getRowData(row.page).error"
        @retry="handleRowRetry(row.page)"
      />
    </template>
  </div>
</template>

<style scoped>
.netflix-home {
  background: var(--bew-bg);
  min-height: 100vh;
  padding: 0 2rem 2rem;
}
</style>
