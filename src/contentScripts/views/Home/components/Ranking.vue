<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useBewlyApp } from '~/composables/useAppProvider'
import type { GridLayoutType } from '~/logic'
import { settings } from '~/logic'
import type { List as RankingPgcItem } from '~/models/video/rankingPgc'

import type { RankingVideoElement } from '../composables/useRankingData'
import { useRankingData } from '../composables/useRankingData'
import type { RankingType } from '../types'

const props = defineProps<{
  gridLayout: GridLayoutType
  topBarVisibility: boolean
}>()

const emit = defineEmits<{
  (e: 'beforeLoading'): void
  (e: 'afterLoading'): void
}>()

const { t } = useI18n()
const { handleBackToTop, handlePageRefresh } = useBewlyApp()

const { items: videoList, pgcItems: PgcList, loading: isLoading, initLoad } = useRankingData()

const rankingTypes = computed((): RankingType[] => {
  return [
    { id: 1, name: t('ranking.all'), rid: 0 },
    { id: 2, name: t('topbar.logo_dropdown.anime'), seasonType: 1 },
    { id: 3, name: t('topbar.logo_dropdown.chinese_anime'), seasonType: 4 },
    { id: 5, name: t('topbar.logo_dropdown.documentary_films'), seasonType: 3 },
    { id: 6, name: t('topbar.logo_dropdown.animations'), rid: 1005 },
    { id: 7, name: t('topbar.logo_dropdown.music'), rid: 1003 },
    { id: 8, name: t('topbar.logo_dropdown.dance'), rid: 1004 },
    { id: 9, name: t('topbar.logo_dropdown.gaming'), rid: 1008 },
    { id: 10, name: t('topbar.logo_dropdown.knowledge'), rid: 1010 },
    { id: 11, name: t('topbar.logo_dropdown.technology'), rid: 1012 },
    { id: 12, name: t('topbar.logo_dropdown.sports'), rid: 1018 },
    { id: 13, name: t('topbar.logo_dropdown.cars'), rid: 1013 },
    { id: 15, name: t('topbar.logo_dropdown.foods'), rid: 1020 },
    { id: 16, name: t('topbar.logo_dropdown.animals'), rid: 1024 },
    { id: 17, name: t('topbar.logo_dropdown.kichiku'), rid: 1007 },
    { id: 18, name: t('topbar.logo_dropdown.fashion'), rid: 1014 },
    { id: 19, name: t('topbar.logo_dropdown.showbiz'), rid: 1002 },
    { id: 20, name: t('topbar.logo_dropdown.cinephile'), rid: 1001 },
    { id: 21, name: t('topbar.logo_dropdown.movies'), seasonType: 2 },
    { id: 22, name: t('topbar.logo_dropdown.tv_shows'), seasonType: 5 },
    { id: 23, name: t('topbar.logo_dropdown.variety_shows'), seasonType: 7 },
    { id: 24, name: t('ranking.original_content'), rid: 0, type: 'origin' },
    { id: 25, name: t('ranking.debut_work'), rid: 0, type: 'rookie' },
  ]
})

const activatedRankingType = ref<RankingType>({ ...rankingTypes.value[0] })
const shouldMoveAsideUp = ref<boolean>(false)
const noMoreContent = ref<boolean>(true) // 排行榜没有分页

watch(() => activatedRankingType.value.id, () => {
  handleBackToTop(settings.value.useSearchPageModeOnHomePage ? 510 : 0)
  initData()
})

watch(() => props.topBarVisibility, () => {
  shouldMoveAsideUp.value = false
  if (settings.value.autoHideTopBar && settings.value.showTopBar) {
    if (props.topBarVisibility)
      shouldMoveAsideUp.value = false
    else
      shouldMoveAsideUp.value = true
  }
})

onMounted(() => {
  initData()
  initPageAction()
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

async function initData() {
  emit('beforeLoading')
  try {
    await initLoad(activatedRankingType.value)
  }
  finally {
    emit('afterLoading')
  }
}

defineExpose({ initData })
</script>

<template>
  <div flex="~ gap-40px">
    <aside
      pos="sticky top-150px" h="[calc(100vh-140px)]" w-200px shrink-0 duration-300
      ease-in-out
      :class="{ hide: shouldMoveAsideUp }"
    >
      <div h-inherit p-20px m--20px of-y-auto of-x-hidden>
        <ul flex="~ col gap-2">
          <li v-for="rankingType in rankingTypes" :key="rankingType.id">
            <a
              :class="{ active: activatedRankingType.id === rankingType.id }"
              px-4 lh-30px h-30px hover:bg="$bew-fill-2" w-inherit
              block rounded="$bew-radius" cursor-pointer transition="all 300 ease-out"
              hover:scale-105 un-text="$bew-text-1"
              @click="activatedRankingType = rankingType"
            >{{ rankingType.name }}</a>
          </li>
        </ul>
      </div>
    </aside>

    <div w-full>
      <template v-if="!('seasonType' in activatedRankingType)">
        <VideoCardGrid
          :items="videoList"
          :grid-layout="gridLayout"
          :loading="isLoading"
          :no-more-content="noMoreContent"
          :transform-item="(item: RankingVideoElement) => item.displayData"
          :get-item-key="(item: RankingVideoElement) => item.aid"
          show-preview
          @refresh="initData"
          @load-more="() => {}"
        />
      </template>
      <template v-else>
        <div
          :class="{
            'grid-adaptive-bangumi': gridLayout === 'adaptive',
            'grid-two-columns': gridLayout === 'twoColumns',
            'grid-one-column': gridLayout === 'oneColumn',
          }"
        >
          <BangumiCard
            v-for="pgc in (PgcList as RankingPgcItem[])"
            :key="pgc.url"
            :bangumi="{
              url: pgc.url,
              cover: pgc.cover,
              title: pgc.title,
              desc: pgc.new_ep.index_show,
              view: pgc.stat.view,
              follow: pgc.stat.follow,
              rank: pgc.rank,
              capsuleText: pgc.rating.replace('分', ''),
              badge: {
                text: pgc.badge_info.text || '',
                bgColor: pgc.badge_info.bg_color || '',
                bgColorDark: pgc.badge_info.bg_color_night || '',
              },
            }"
            :horizontal="gridLayout !== 'adaptive'"
          />

          <!-- skeleton -->
          <template v-if="isLoading">
            <BangumiCardSkeleton
              v-for="item in 30" :key="item"
              :horizontal="gridLayout !== 'adaptive'"
            />
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.active {
  --uno: "scale-110 bg-$bew-theme-color-auto text-$bew-text-auto shadow-$bew-shadow-2";
}

.hide {
  --uno: "h-[calc(100vh-70)] translate-y--70px";
}

/* Bangumi Grid 布局 */
.grid-adaptive-bangumi {
  --uno: "grid gap-5";
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.grid-two-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.grid-one-column {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 20px;
}
</style>
