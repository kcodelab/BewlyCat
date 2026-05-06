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
import ChannelsGrid from './ChannelsGrid.vue'
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

// ── 懒加载：row 进入视口（含 300px preload）首次触发 ──
function loadRowIfEmpty(page: HomeSubPage) {
  switch (page) {
    case HomeSubPage.ForYou:
      if (forYou.videoList.value.length === 0)
        forYou.getData()
      break
    case HomeSubPage.Trending:
      if (trending.items.value.length === 0)
        trending.load()
      break
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

// ── 横向无限滚动：row 滚到末尾时拉下一页 ──
function loadRowMore(page: HomeSubPage) {
  switch (page) {
    case HomeSubPage.ForYou:
      forYou.handleLoadMore?.()
      break
    case HomeSubPage.Trending:
      if (!trending.noMoreContent?.value)
        trending.load()
      break
    case HomeSubPage.Following:
      if (!following.noMoreContent?.value)
        following.handleLoadMore?.()
      break
    case HomeSubPage.SubscribedSeries:
      if (!subscribedSeries.noMoreContent?.value)
        subscribedSeries.load()
      break
    case HomeSubPage.Live:
      if (!live.noMoreContent?.value)
        live.load()
      break
    // Weekly / Precious 都是固定列表，无 loadMore
  }
}

// ── 当前 row 是否还有更多分页可加载 ──
function getRowHasMore(page: HomeSubPage): boolean {
  switch (page) {
    case HomeSubPage.ForYou: return true // ForYou 推荐流可一直滚
    case HomeSubPage.Trending: return !trending.noMoreContent?.value
    case HomeSubPage.Following: return !following.noMoreContent?.value
    case HomeSubPage.SubscribedSeries: return !subscribedSeries.noMoreContent?.value
    case HomeSubPage.Live: return !live.noMoreContent?.value
    default: return false // Weekly / Precious 无分页
  }
}

// ── Hover-target ref for VideoCardHover Teleport (决议 #4) ────────
const hoverTargetRef = ref<HTMLElement | null>(null)
provide('netflix-hover-target', hoverTargetRef)

// ── Mount: 仅加载 Hero + 首个可见 row 的数据 ──────────────────────────
// 其他 row 由 IntersectionObserver 进入视口前 300px 触发懒加载，
// 滚到末端时由 loadRowMore 拉下一页（无限滚动）。
onMounted(() => {
  // Hero 必须立即出，trending 是 hero picker 的主源
  if (trending.items.value.length === 0)
    trending.load()
  // ForYou 同时供 hero 兜底 + 第一个 row，立即拉
  if (forYou.videoList.value.length === 0)
    forYou.getData()
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

    <!-- Dynamic SubPage Rows（懒加载 + 横向无限滚动） -->
    <template v-for="row in rows" :key="row.key">
      <HorizontalRow
        v-if="row.kind === 'subpage'"
        :title="getRowTitle(row.page)"
        :items="getRowData(row.page).items"
        :loading="getRowData(row.page).loading"
        :error="getRowData(row.page).error"
        :has-more="getRowHasMore(row.page)"
        @retry="handleRowRetry(row.page)"
        @activate="loadRowIfEmpty(row.page)"
        @load-more="loadRowMore(row.page)"
      />
    </template>

    <!-- Channels Grid -->
    <ChannelsGrid />
  </div>
</template>

<style scoped>
.netflix-home {
  background: var(--bew-bg);
  min-height: 100vh;
  padding: 0 2rem 2rem;
}
</style>
