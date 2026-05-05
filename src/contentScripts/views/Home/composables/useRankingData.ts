import { reactive, ref } from 'vue'

import type { Video } from '~/components/VideoCard/types'
import type { List as RankingVideoItem, RankingResult } from '~/models/video/ranking'
import type { List as RankingPgcItem, RankingPgcResult } from '~/models/video/rankingPgc'
import api from '~/utils/api'
import { decodeHtmlEntities } from '~/utils/htmlDecode'

import type { RankingType } from '../types'

// 扩展 RankingVideoItem 以包含预处理的显示数据
export interface RankingVideoElement extends RankingVideoItem {
  displayData?: Video
}

// 模块作用域单例状态
const items = reactive<RankingVideoElement[]>([])
const pgcItems = reactive<RankingPgcItem[]>([])
const loading = ref<boolean>(false)
const error = ref<Error | null>(null)
let inflight: Promise<void> | null = null

function transformRankingVideo(item: RankingVideoItem, rank: number): Video {
  return {
    id: Number(item.aid),
    duration: item.duration,
    title: decodeHtmlEntities(item.title),
    desc: decodeHtmlEntities(item.desc),
    cover: item.pic,
    author: {
      name: decodeHtmlEntities(item.owner.name),
      authorFace: item.owner.face,
      mid: item.owner.mid,
    },
    view: item.stat.view,
    danmaku: item.stat.danmaku,
    like: item.stat.like,
    likeStr: (item.stat as any)?.like_str ?? item.stat.like,
    publishedTimestamp: item.pubdate,
    bvid: item.bvid,
    rank,
    cid: item.cid,
    threePointV2: [],
  }
}

interface Deps {
  fetchRankingVideos: (params: { rid?: number, type?: string }) => Promise<RankingResult>
  fetchRankingPgc: (params: { season_type?: number }) => Promise<RankingPgcResult>
}

function defaultFetchRankingVideos(params: { rid?: number, type?: string }): Promise<RankingResult> {
  return api.ranking.getRankingVideos(params)
}

function defaultFetchRankingPgc(params: { season_type?: number }): Promise<RankingPgcResult> {
  return api.ranking.getRankingPgc(params)
}

export function useRankingData(override?: Partial<Deps>) {
  const effectiveDeps: Deps = {
    fetchRankingVideos: defaultFetchRankingVideos,
    fetchRankingPgc: defaultFetchRankingPgc,
    ...override,
  }

  async function loadVideos(rankingType: RankingType) {
    if (inflight)
      return inflight
    items.length = 0
    loading.value = true
    error.value = null
    inflight = (async () => {
      try {
        const response: RankingResult = await effectiveDeps.fetchRankingVideos({
          rid: rankingType.rid,
          type: 'type' in rankingType ? rankingType.type : 'all',
        })
        if (response.code === 0) {
          const { list } = response.data
          const processedList = list.map((item, index) => ({
            ...item,
            displayData: transformRankingVideo(item, index + 1),
          }))
          Object.assign(items, processedList)
          items.length = processedList.length
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

  async function loadPgc(rankingType: RankingType) {
    if (inflight)
      return inflight
    pgcItems.length = 0
    loading.value = true
    error.value = null
    inflight = (async () => {
      try {
        const response: RankingPgcResult = await effectiveDeps.fetchRankingPgc({
          season_type: rankingType.seasonType,
        })
        if (response.code === 0) {
          Object.assign(pgcItems, response.data.list)
          pgcItems.length = response.data.list.length
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

  function initLoad(rankingType: RankingType) {
    items.length = 0
    pgcItems.length = 0
    inflight = null
    if ('seasonType' in rankingType)
      return loadPgc(rankingType)
    else
      return loadVideos(rankingType)
  }

  return { items, pgcItems, loading, error, loadVideos, loadPgc, initLoad }
}

export function _resetForTest() {
  items.length = 0
  pgcItems.length = 0
  loading.value = false
  error.value = null
  inflight = null
}
