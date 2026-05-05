import { ref } from 'vue'

import type { Video } from '~/components/VideoCard/types'
import type { FollowingLiveResult, List as FollowingLiveItem } from '~/models/live/getFollowingLiveList'
import api from '~/utils/api'
import { decodeHtmlEntities } from '~/utils/htmlDecode'

interface VideoElement {
  uniqueId: string
  item?: FollowingLiveItem
  displayData?: Video
}

// 模块作用域单例状态
const items = ref<VideoElement[]>([])
const loading = ref<boolean>(false)
const error = ref<Error | null>(null)
const needToLoginFirst = ref<boolean>(false)
const page = ref<number>(1)
const noMoreContent = ref<boolean>(false)
let inflight: Promise<void> | null = null

function transformLiveVideo(item: FollowingLiveItem): Video {
  return {
    id: item.roomid,
    title: decodeHtmlEntities(item.title),
    cover: item.room_cover,
    author: {
      name: decodeHtmlEntities(item.uname),
      authorFace: item.face,
      mid: item.uid,
    },
    viewStr: item.text_small,
    tag: decodeHtmlEntities(item.area_name_v2),
    roomid: item.roomid,
    liveStatus: item.live_status,
    threePointV2: [],
  }
}

interface Deps {
  fetchLive: (params: { page: number, page_size: number }) => Promise<FollowingLiveResult>
}

function defaultFetchLive(params: { page: number, page_size: number }): Promise<FollowingLiveResult> {
  return api.live.getFollowingLiveList(params)
}

export function useLiveData(override?: Partial<Deps>) {
  const effectiveDeps: Deps = { fetchLive: defaultFetchLive, ...override }

  async function loadOnePage(): Promise<void> {
    if (noMoreContent.value)
      return

    const response: FollowingLiveResult = await effectiveDeps.fetchLive({
      page: page.value,
      page_size: 9,
    })

    if (response.code === -101) {
      noMoreContent.value = true
      needToLoginFirst.value = true
      return
    }

    if (response.code === 0) {
      if (response.data.list.length < 9)
        noMoreContent.value = true

      page.value++

      const newItems = response.data.list.map((liveItem: FollowingLiveItem) => ({
        uniqueId: `${liveItem.roomid}`,
        item: liveItem,
        displayData: transformLiveVideo(liveItem),
      }))

      items.value = [...items.value, ...newItems]
    }
  }

  async function load() {
    if (inflight)
      return inflight
    if (noMoreContent.value)
      return Promise.resolve()
    loading.value = true
    error.value = null
    inflight = (async () => {
      try {
        await loadOnePage()
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
    page.value = 1
    items.value = []
    noMoreContent.value = false
    needToLoginFirst.value = false
    error.value = null
    inflight = null

    loading.value = true
    try {
      // 初次加载时多加载几批确保有足够内容
      for (let i = 0; i < 3 && !noMoreContent.value; i++)
        await loadOnePage()
    }
    catch (e) {
      error.value = e as Error
    }
    finally {
      loading.value = false
    }
  }

  return { items, loading, error, needToLoginFirst, noMoreContent, load, initLoad }
}

export function _resetForTest() {
  items.value = []
  loading.value = false
  error.value = null
  needToLoginFirst.value = false
  page.value = 1
  noMoreContent.value = false
  inflight = null
}
