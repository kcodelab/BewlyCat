import { ref } from 'vue'

import type { Video } from '~/components/VideoCard/types'
import type { List as VideoItem, TrendingResult } from '~/models/video/trending'
import api from '~/utils/api'
import { decodeHtmlEntities } from '~/utils/htmlDecode'

interface VideoElement {
  uniqueId: string
  item?: VideoItem
  displayData?: Video
}

// 模块作用域单例状态
const items = ref<VideoElement[]>([])
const loading = ref<boolean>(false)
const error = ref<Error | null>(null)
const pn = ref<number>(1)
const noMoreContent = ref<boolean>(false)
let inflight: Promise<void> | null = null

// 数据转换函数
function transformTrendingVideo(item: VideoElement): Video | undefined {
  if (!item.item)
    return undefined

  const videoItem = item.item
  return {
    id: Number(videoItem.aid),
    duration: videoItem.duration,
    title: decodeHtmlEntities(videoItem.title),
    desc: decodeHtmlEntities(videoItem.desc),
    cover: videoItem.pic,
    author: {
      name: decodeHtmlEntities(videoItem.owner.name),
      authorFace: videoItem.owner.face,
      mid: videoItem.owner.mid,
    },
    view: typeof videoItem.stat.view === 'number' ? videoItem.stat.view : Number(videoItem.stat.view),
    danmaku: typeof videoItem.stat.danmaku === 'number' ? videoItem.stat.danmaku : Number(videoItem.stat.danmaku),
    like: typeof videoItem.stat.like === 'number' ? videoItem.stat.like : Number(videoItem.stat.like),
    likeStr: (videoItem.stat as any)?.like_str ?? videoItem.stat.like,
    publishedTimestamp: videoItem.pubdate,
    bvid: videoItem.bvid,
    tag: decodeHtmlEntities(videoItem.rcmd_reason.content),
    cid: videoItem.cid,
    threePointV2: [],
  }
}

interface Deps {
  fetchTrending: () => Promise<TrendingResult>
}

function defaultFetchTrending(): Promise<TrendingResult> {
  return api.video.getPopularVideos({
    pn: pn.value++,
    ps: 30,
  })
}

// Production callers MUST call useTrendingData() with NO arguments.
// `override` is a TEST-ONLY seam.
export function useTrendingData(override?: Partial<Deps>) {
  const effectiveDeps: Deps = { fetchTrending: defaultFetchTrending, ...override }

  async function load() {
    if (inflight)
      return inflight
    loading.value = true
    error.value = null
    inflight = (async () => {
      try {
        const response: TrendingResult = await effectiveDeps.fetchTrending()
        if (response.code === 0) {
          noMoreContent.value = response.data.no_more

          const newItems = response.data.list.map((item: VideoItem) => ({
            uniqueId: `${item.aid}`,
            item,
            displayData: transformTrendingVideo({ uniqueId: `${item.aid}`, item }),
          }))

          items.value = [...items.value, ...newItems]

          // 初次加载且数据不足时继续加载
          if (items.value.length < 30 && !noMoreContent.value) {
            inflight = null
            await load()
          }
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

  async function initLoad() {
    noMoreContent.value = false
    items.value = []
    pn.value = 1
    error.value = null
    inflight = null
    await load()
  }

  return { items, loading, error, noMoreContent, load, initLoad }
}

export function _resetForTest() {
  items.value = []
  loading.value = false
  error.value = null
  pn.value = 1
  noMoreContent.value = false
  inflight = null
}
