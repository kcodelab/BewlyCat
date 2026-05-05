import { ref } from 'vue'

import type { Video } from '~/components/VideoCard/types'
import type { PreciousItem, PreciousResult } from '~/models/video/precious'
import api from '~/utils/api'
import { decodeHtmlEntities } from '~/utils/htmlDecode'

interface VideoElement {
  uniqueId: string
  item?: PreciousItem
  displayData?: Video
}

// 模块作用域单例状态
const items = ref<VideoElement[]>([])
const loading = ref<boolean>(false)
const error = ref<Error | null>(null)
let inflight: Promise<void> | null = null

function transformPreciousVideo(item: PreciousItem): Video {
  return {
    id: Number(item.aid),
    duration: item.duration,
    title: decodeHtmlEntities(item.title),
    desc: decodeHtmlEntities(item.desc),
    cover: item.pic,
    author: item.owner
      ? {
          name: decodeHtmlEntities(item.owner.name),
          authorFace: item.owner.face,
          mid: item.owner.mid,
        }
      : undefined,
    view: item.stat?.view,
    danmaku: item.stat?.danmaku,
    like: item.stat?.like,
    likeStr: item.stat?.like_str ?? item.stat?.like,
    publishedTimestamp: item.pubdate,
    bvid: item.bvid,
    cid: item.cid,
    threePointV2: [],
  }
}

interface Deps {
  fetchPrecious: () => Promise<PreciousResult>
}

function defaultFetchPrecious(): Promise<PreciousResult> {
  return api.ranking.getPreciousVideos()
}

export function usePreciousData(override?: Partial<Deps>) {
  const effectiveDeps: Deps = { fetchPrecious: defaultFetchPrecious, ...override }

  async function load() {
    if (inflight)
      return inflight
    loading.value = true
    error.value = null
    inflight = (async () => {
      try {
        const response: PreciousResult = await effectiveDeps.fetchPrecious()
        if (response.code === 0) {
          const list = Array.isArray((response.data as any)?.list) ? (response.data as any).list as PreciousItem[] : []
          items.value = list.map(item => ({
            uniqueId: `${item.aid}`,
            item,
            displayData: transformPreciousVideo(item),
          }))
        }
      }
      catch (e) {
        error.value = e as Error
      }
      finally {
        items.value = items.value.filter(video => video.item)
        loading.value = false
        inflight = null
      }
    })()
    return inflight
  }

  async function initLoad() {
    items.value = []
    error.value = null
    inflight = null
    await load()
  }

  return { items, loading, error, load, initLoad }
}

export function _resetForTest() {
  items.value = []
  loading.value = false
  error.value = null
  inflight = null
}
