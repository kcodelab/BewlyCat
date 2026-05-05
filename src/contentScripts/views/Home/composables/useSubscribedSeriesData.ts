import { ref } from 'vue'

import type { Video } from '~/components/VideoCard/types'
import type { DataItem as MomentItem, MomentResult } from '~/models/moment/moment'
import api from '~/utils/api'
import { decodeHtmlEntities } from '~/utils/htmlDecode'

interface VideoElement {
  uniqueId: string
  item?: MomentItem
  displayData?: Video
}

// 模块作用域单例状态
const items = ref<VideoElement[]>([])
const loading = ref<boolean>(false)
const error = ref<Error | null>(null)
const needToLoginFirst = ref<boolean>(false)
const offset = ref<string>('')
const updateBaseline = ref<string>('')
const noMoreContent = ref<boolean>(false)
const noMoreContentWarning = ref<boolean>(false)
let inflight: Promise<void> | null = null

function transformSubscribedSeriesVideo(item: MomentItem): Video {
  return {
    id: item.modules.module_author.mid,
    title: decodeHtmlEntities(`${item.modules.module_dynamic.major.pgc?.title}`),
    cover: `${item.modules.module_dynamic.major.pgc?.cover}`,
    author: {
      name: decodeHtmlEntities(item.modules.module_author.name),
      authorUrl: item.modules.module_author.jump_url,
      authorFace: item.modules.module_author.face,
      mid: item.modules.module_author.mid,
    },
    viewStr: item.modules.module_dynamic.major.pgc?.stat.play,
    danmakuStr: item.modules.module_dynamic.major.pgc?.stat.danmaku,
    likeStr: item.modules.module_dynamic.major.pgc?.stat.like,
    capsuleText: decodeHtmlEntities(item.modules.module_author.pub_time),
    epid: item.modules.module_dynamic.major.pgc?.epid,
    threePointV2: [],
  }
}

interface Deps {
  fetchSubscribedSeries: (params: { type: string, offset?: string, update_baseline?: string }) => Promise<MomentResult>
}

function defaultFetchSubscribedSeries(params: { type: string, offset?: string, update_baseline?: string }): Promise<MomentResult> {
  return api.moment.getMoments(params)
}

export function useSubscribedSeriesData(override?: Partial<Deps>) {
  const effectiveDeps: Deps = { fetchSubscribedSeries: defaultFetchSubscribedSeries, ...override }

  async function loadOnePage(): Promise<void> {
    if (noMoreContent.value)
      return

    if (offset.value === '0') {
      noMoreContent.value = true
      return
    }

    const response: MomentResult = await effectiveDeps.fetchSubscribedSeries({
      type: 'pgc',
      offset: offset.value || undefined,
      update_baseline: updateBaseline.value,
    })

    if (response.code === -101) {
      noMoreContent.value = true
      needToLoginFirst.value = true
      return
    }

    if (response.code === 0) {
      offset.value = response.data.offset
      updateBaseline.value = response.data.update_baseline

      const newItems = response.data.items.map((item: MomentItem) => ({
        uniqueId: `${item.id_str}`,
        item,
        displayData: transformSubscribedSeriesVideo(item),
      }))

      items.value = [...items.value, ...newItems]
    }
    else if (response.code === -101) {
      needToLoginFirst.value = true
    }
  }

  async function load() {
    if (inflight)
      return inflight
    if (noMoreContent.value) {
      noMoreContentWarning.value = true
      return Promise.resolve()
    }
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
    offset.value = ''
    updateBaseline.value = ''
    items.value = []
    noMoreContent.value = false
    noMoreContentWarning.value = false
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

  return { items, loading, error, needToLoginFirst, noMoreContent, noMoreContentWarning, load, initLoad }
}

export function _resetForTest() {
  items.value = []
  loading.value = false
  error.value = null
  needToLoginFirst.value = false
  offset.value = ''
  updateBaseline.value = ''
  noMoreContent.value = false
  noMoreContentWarning.value = false
  inflight = null
}
