import { ref } from 'vue'

import type { Video } from '~/components/VideoCard/types'
import type { PopularSeriesItem, PopularSeriesListResult, PopularSeriesOneResult, PopularSeriesVideoItem } from '~/models/video/popularSeries'
import api from '~/utils/api'
import { decodeHtmlEntities } from '~/utils/htmlDecode'

export interface WeeklyVideoElement extends PopularSeriesVideoItem {
  displayData?: Video
}

// 模块作用域单例状态
const items = ref<WeeklyVideoElement[]>([])
const seriesList = ref<PopularSeriesItem[]>([])
const activatedSeries = ref<PopularSeriesItem | null>(null)
const loading = ref<boolean>(false)
const error = ref<Error | null>(null)
let inflight: Promise<void> | null = null

function transformWeeklyVideo(item: PopularSeriesVideoItem, rank: number): Video {
  return {
    id: Number(item.aid),
    duration: item.duration,
    title: decodeHtmlEntities(item.title),
    desc: decodeHtmlEntities(item.desc),
    cover: item.pic,
    author: {
      name: decodeHtmlEntities(item.owner?.name),
      authorFace: item.owner?.face,
      mid: item.owner?.mid,
    },
    view: item.stat?.view,
    danmaku: item.stat?.danmaku,
    like: item.stat?.like,
    likeStr: item.stat?.like_str ?? item.stat?.like,
    publishedTimestamp: item.pubdate,
    bvid: item.bvid,
    cid: item.cid,
    rank,
    threePointV2: [],
  }
}

interface Deps {
  fetchSeriesList: () => Promise<PopularSeriesListResult>
  fetchSeriesOne: (params: { number: number }) => Promise<PopularSeriesOneResult>
}

function defaultFetchSeriesList(): Promise<PopularSeriesListResult> {
  return api.ranking.getPopularSeriesList()
}

function defaultFetchSeriesOne(params: { number: number }): Promise<PopularSeriesOneResult> {
  return api.ranking.getPopularSeriesOne(params)
}

export function useWeeklyData(override?: Partial<Deps>) {
  const effectiveDeps: Deps = {
    fetchSeriesList: defaultFetchSeriesList,
    fetchSeriesOne: defaultFetchSeriesOne,
    ...override,
  }

  async function loadSeriesOne(series: PopularSeriesItem): Promise<void> {
    if (inflight)
      return inflight as any
    items.value = []
    loading.value = true
    error.value = null
    inflight = (async () => {
      try {
        const res: PopularSeriesOneResult = await effectiveDeps.fetchSeriesOne({ number: series.number })
        if (res && res.code === 0 && res.data && Array.isArray(res.data.list)) {
          items.value = res.data.list.map((item, index) => ({
            ...item,
            displayData: transformWeeklyVideo(item, index + 1),
          }))
        }
      }
      catch (e) {
        error.value = e as Error
      }
      finally {
        loading.value = false
        inflight = null
      }
    })()
    return inflight
  }

  async function initLoad(): Promise<void> {
    items.value = []
    seriesList.value = []
    activatedSeries.value = null
    error.value = null
    inflight = null

    try {
      const res: PopularSeriesListResult = await effectiveDeps.fetchSeriesList()
      if (res && res.code === 0 && res.data && Array.isArray(res.data.list)) {
        seriesList.value = [...res.data.list].sort((a, b) => (b.number || 0) - (a.number || 0))
        if (seriesList.value.length) {
          activatedSeries.value = seriesList.value[0]
          await loadSeriesOne(activatedSeries.value)
        }
      }
    }
    catch (e) {
      error.value = e as Error
    }
  }

  return { items, seriesList, activatedSeries, loading, error, loadSeriesOne, initLoad }
}

export function _resetForTest() {
  items.value = []
  seriesList.value = []
  activatedSeries.value = null
  loading.value = false
  error.value = null
  inflight = null
}
