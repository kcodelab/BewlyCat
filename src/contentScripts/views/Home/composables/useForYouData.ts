import { ref } from 'vue'

import { FilterType, useFilter } from '~/composables/useFilter'
import { LanguageType } from '~/enums/appEnums'
import { appAuthTokens, settings } from '~/logic'
import type { AppForYouResult, Item as AppVideoItem } from '~/models/video/appForYou'
import type { forYouResult, Item as VideoItem } from '~/models/video/forYou'
import type { AppVideoElement, VideoCardDisplayData, VideoElement } from '~/stores/forYouStore'
import api from '~/utils/api'
import { TVAppKey } from '~/utils/authProvider'
import { decodeHtmlEntities } from '~/utils/htmlDecode'
import { isVerticalVideo } from '~/utils/uriParse'

// 模块作用域单例状态
const videoList = ref<VideoElement[]>([])
const appVideoList = ref<AppVideoElement[]>([])
const isLoading = ref<boolean>(false)
const requestFailed = ref<boolean>(false)
const needToLoginFirst = ref<boolean>(false)
const noMoreContent = ref<boolean>(false)
const refreshIdx = ref<number>(1)
const consecutiveEmptyLoads = ref<number>(0)
const appConsecutiveEmptyLoads = ref<number>(0)
const isRecursiveLoading = ref<boolean>(false)
const scrollLoadStartLength = ref<number>(0)
const APP_LOAD_BATCHES = ref<number>(1)
const error = ref<Error | null>(null)

const MAX_EMPTY_LOADS = 5
const PAGE_SIZE = 30

// ---- Data transform helpers ----

function transformWebVideo(item: VideoItem): VideoCardDisplayData {
  return {
    id: item.id,
    duration: item.duration,
    title: decodeHtmlEntities(item.title),
    cover: item.pic,
    author: {
      name: decodeHtmlEntities(item.owner?.name || ''),
      authorFace: item.owner?.face || '',
      followed: !!item.is_followed,
      mid: item.owner?.mid || 0,
    },
    tag: decodeHtmlEntities(item?.rcmd_reason?.content),
    view: item.stat?.view || 0,
    danmaku: item.stat?.danmaku || 0,
    like: item.stat?.like,
    publishedTimestamp: item.pubdate,
    bvid: item.bvid,
    cid: item.cid,
    goto: item.goto,
    trackId: item.track_id,
    threePointV2: [],
  }
}

function transformAppVideo(item: AppVideoItem): VideoCardDisplayData {
  const bottomReason = item?.bottom_rcmd_reason?.trim()
  const followed = bottomReason === '已关注' || bottomReason === '已關注'
  const descPart = item?.desc?.split('·')?.[1]?.trim()
  const capsuleText = descPart || (followed ? bottomReason : undefined)
  let type: 'horizontal' | 'vertical' | 'bangumi' = 'horizontal'
  if (item.card_goto === 'bangumi') {
    type = 'bangumi'
  }
  else if (item.uri && isVerticalVideo(item.uri)) {
    type = 'vertical'
  }
  return {
    id: item.args?.aid ?? 0,
    durationStr: item.cover_right_text,
    title: decodeHtmlEntities(item.title),
    cover: item.cover || '',
    author: {
      name: decodeHtmlEntities(item?.mask?.avatar?.text || ''),
      authorFace: item?.mask?.avatar?.cover || item?.avatar?.cover || '',
      followed,
      mid: item?.mask?.avatar?.up_id || 0,
    },
    capsuleText: decodeHtmlEntities(capsuleText),
    bvid: item.bvid || '',
    viewStr: item.cover_left_text_1,
    danmakuStr: item.cover_left_text_2,
    cid: item?.player_args?.cid,
    goto: item?.goto,
    trackId: item?.track_id,
    url: item?.goto === 'bangumi' ? item.uri : '',
    type,
    threePointV2: item?.three_point_v2 || [],
  }
}

function getWebVideoKey(item: VideoItem): string {
  const bvid = item.bvid?.trim()
  if (bvid)
    return bvid
  return `${item.id}`
}

function buildLastShowlist(items: VideoItem[]): string {
  const parts: string[] = []
  const seen = new Set<number>()
  items.forEach((item) => {
    if (!item?.id || item.goto !== 'av' || seen.has(item.id))
      return
    seen.add(item.id)
    const followedFlag = item.is_followed ? 'n_' : ''
    parts.push(`av_${followedFlag}${item.id}`)
  })
  return parts.join('_')
}

function getLastShowlistFromList(list: VideoElement[], limit: number): string {
  const items = list
    .map(video => video.item)
    .filter((item): item is VideoItem => !!item && !!item.id)
  return buildLastShowlist(items.slice(-limit))
}

function getWebFetchRow(list: VideoElement[]): number {
  return list.reduce((count, video) => (video.item ? count + 1 : count), 0)
}

interface Deps {
  fetchRecommendVideos: (params: any) => Promise<forYouResult>
  fetchAppRecommendVideos: (params: any) => Promise<AppForYouResult>
  haveScrollbar: () => Promise<boolean>
  isPageVisible: () => boolean
}

function defaultFetchRecommendVideos(params: any): Promise<forYouResult> {
  return api.video.getRecommendVideos(params)
}

function defaultFetchAppRecommendVideos(params: any): Promise<AppForYouResult> {
  return api.video.getAppRecommendVideos(params)
}

async function getRecommendVideos(effectiveDeps: Deps): Promise<void> {
  const filterFunc = useFilter(
    ['is_followed'],
    [FilterType.duration, FilterType.viewCount, FilterType.likeCount, FilterType.title, FilterType.user, FilterType.user, FilterType.publishTime],
    [['duration'], ['stat', 'view'], ['stat', 'like'], ['title'], ['owner', 'name'], ['owner', 'mid'], ['pubdate']],
  )

  if (consecutiveEmptyLoads.value >= MAX_EMPTY_LOADS) {
    console.warn('达到最大连续空加载次数，停止加载')
    noMoreContent.value = true
    return
  }
  const beforeLoadCount = videoList.value.filter(video => video.item).length
  const currentRefreshIdx = refreshIdx.value
  const fetchRow = getWebFetchRow(videoList.value)
  const lastShowlist = getLastShowlistFromList(videoList.value, PAGE_SIZE)
  const response: forYouResult = await effectiveDeps.fetchRecommendVideos({
    fresh_idx: currentRefreshIdx,
    fresh_idx_1h: currentRefreshIdx,
    ps: PAGE_SIZE,
    fetch_row: fetchRow > 0 ? fetchRow : undefined,
    last_showlist: lastShowlist || undefined,
  })
  if (!response) {
    console.error('Failed to load web recommendations: Response is undefined')
    requestFailed.value = true
    noMoreContent.value = true
    return
  }
  if (!response.data) {
    requestFailed.value = true
    noMoreContent.value = true
    return
  }
  if (response.code === 0) {
    refreshIdx.value++
    const resData = [] as VideoItem[]
    const existingIds = new Set<string>()
    videoList.value.forEach((video) => {
      if (video.item)
        existingIds.add(getWebVideoKey(video.item))
    })
    response.data.item.forEach((item: VideoItem) => {
      if (item.goto === 'ad')
        return
      if (!item.owner || !item.stat)
        return
      if (filterFunc.value && !filterFunc.value(item))
        return
      const itemKey = getWebVideoKey(item)
      if (existingIds.has(itemKey))
        return
      existingIds.add(itemKey)
      resData.push(item)
    })
    if (!beforeLoadCount) {
      videoList.value = resData.map(item => ({
        uniqueId: getWebVideoKey(item),
        item,
        displayData: transformWebVideo(item),
      }))
    }
    else {
      resData.forEach((item) => {
        if (!filterFunc.value) {
          videoList.value.push({ uniqueId: getWebVideoKey(item), item, displayData: transformWebVideo(item) })
        }
        else {
          const findFirstEmptyItemIndex = videoList.value.findIndex(video => !video.item)
          if (findFirstEmptyItemIndex !== -1) {
            videoList.value[findFirstEmptyItemIndex] = { uniqueId: getWebVideoKey(item), item, displayData: transformWebVideo(item) }
          }
          else {
            videoList.value.push({ uniqueId: getWebVideoKey(item), item, displayData: transformWebVideo(item) })
          }
        }
      })
    }
    const afterLoadCount = videoList.value.filter(video => video.item).length
    if (afterLoadCount > beforeLoadCount)
      consecutiveEmptyLoads.value = 0
    else
      consecutiveEmptyLoads.value++
  }
  else if (response.code === 62011) {
    needToLoginFirst.value = true
  }
  else {
    console.error('API returned error code:', response.code, response.message)
    requestFailed.value = true
    noMoreContent.value = true
  }

  // After main fetch logic - check if we need to recurse
  const filledItems = videoList.value.filter(video => video.item)
  videoList.value = filledItems
  if (!needToLoginFirst.value && !noMoreContent.value) {
    const hasScrollbar = await effectiveDeps.haveScrollbar()
    if (!hasScrollbar || filledItems.length < PAGE_SIZE || filledItems.length < 1) {
      if (effectiveDeps.isPageVisible() && consecutiveEmptyLoads.value < MAX_EMPTY_LOADS) {
        isRecursiveLoading.value = true
        try {
          await getRecommendVideos(effectiveDeps)
        }
        finally {
          isRecursiveLoading.value = false
        }
      }
      else if (consecutiveEmptyLoads.value >= MAX_EMPTY_LOADS) {
        noMoreContent.value = true
      }
    }
  }
}

async function getAppRecommendVideos(effectiveDeps: Deps): Promise<void> {
  const appFilterFunc = useFilter(
    ['bottom_rcmd_reason'],
    [FilterType.filterOutVerticalVideos, FilterType.duration, FilterType.viewCountStr, FilterType.title, FilterType.user, FilterType.user],
    [['uri'], ['player_args', 'duration'], ['cover_left_text_1'], ['title'], ['mask', 'avatar', 'text'], ['mask', 'avatar', 'up_id']],
  )

  if (appConsecutiveEmptyLoads.value >= MAX_EMPTY_LOADS) {
    console.warn('APP模式达到最大连续空加载次数，停止加载')
    noMoreContent.value = true
    return
  }
  if (!appAuthTokens.value.accessToken) {
    console.warn('APP 推荐模式需要登录，access token 为空')
    needToLoginFirst.value = true
    return
  }
  const batchesToLoad = APP_LOAD_BATCHES.value
  const beforeLoadCount = appVideoList.value.length
  for (let batch = 0; batch < batchesToLoad; batch++) {
    try {
      const lastIdx = appVideoList.value.length > 0 && appVideoList.value[appVideoList.value.length - 1].item
        ? appVideoList.value[appVideoList.value.length - 1].item!.idx
        : 1
      const response: AppForYouResult = await effectiveDeps.fetchAppRecommendVideos({
        access_key: appAuthTokens.value.accessToken,
        s_locale: settings.value.language === LanguageType.Mandarin_TW || settings.value.language === LanguageType.Cantonese ? 'zh-Hant_TW' : 'zh-Hans_CN',
        c_locate: settings.value.language === LanguageType.Mandarin_TW || settings.value.language === LanguageType.Cantonese ? 'zh-Hant_TW' : 'zh-Hans_CN',
        appkey: TVAppKey.appkey,
        idx: lastIdx,
      })
      if (!response) {
        console.error('Failed to load batch', batch, 'Response is undefined')
        requestFailed.value = true
        break
      }
      if (response.code === 0) {
        response.data.items.forEach((item: AppVideoItem) => {
          if (item.card_type.includes('banner') || item.card_type === 'cm_v1')
            return
          if (appFilterFunc.value && !appFilterFunc.value(item))
            return
          const hasValidId = (item.args?.aid && item.args.aid > 0) || (item.bvid && item.bvid.trim() !== '')
          if (!hasValidId)
            return
          const videoId = item.args?.aid || item.bvid
          const isDuplicate = appVideoList.value.some(video =>
            video.item && (video.item.args?.aid === item.args?.aid || video.item.bvid === item.bvid),
          )
          if (isDuplicate)
            return
          appVideoList.value.push({
            uniqueId: `${videoId || item.idx}`,
            item,
            displayData: transformAppVideo(item),
          })
        })
      }
      else if (response.code === 62011) {
        needToLoginFirst.value = true
        break
      }
    }
    catch (err) {
      console.error('Failed to load batch', batch, err)
      requestFailed.value = true
      break
    }
  }
  const afterLoadCount = appVideoList.value.length
  if (afterLoadCount > beforeLoadCount)
    appConsecutiveEmptyLoads.value = 0
  else
    appConsecutiveEmptyLoads.value++
  if (!needToLoginFirst.value) {
    const hasScrollbar = await effectiveDeps.haveScrollbar()
    let shouldContinue = false
    if (!hasScrollbar || appVideoList.value.length < PAGE_SIZE) {
      shouldContinue = true
    }
    else if (scrollLoadStartLength.value > 0) {
      const loadedCount = appVideoList.value.length - scrollLoadStartLength.value
      if (loadedCount < PAGE_SIZE)
        shouldContinue = true
      else
        scrollLoadStartLength.value = 0
    }
    if (shouldContinue && effectiveDeps.isPageVisible() && appConsecutiveEmptyLoads.value < MAX_EMPTY_LOADS) {
      isRecursiveLoading.value = true
      try {
        await getAppRecommendVideos(effectiveDeps)
      }
      finally {
        isRecursiveLoading.value = false
      }
    }
    else if (appConsecutiveEmptyLoads.value >= MAX_EMPTY_LOADS) {
      noMoreContent.value = true
    }
  }
}

export function useForYouData(override?: Partial<Deps>) {
  const effectiveDeps: Deps = {
    fetchRecommendVideos: defaultFetchRecommendVideos,
    fetchAppRecommendVideos: defaultFetchAppRecommendVideos,
    haveScrollbar: async () => false,
    isPageVisible: () => !document.hidden,
    ...override,
  }

  async function getData(): Promise<void> {
    isLoading.value = true
    requestFailed.value = false
    try {
      if (settings.value.recommendationMode === 'web') {
        await getRecommendVideos(effectiveDeps)
      }
      else {
        await getAppRecommendVideos(effectiveDeps)
      }
    }
    catch {
      requestFailed.value = true
    }
    finally {
      isLoading.value = false
    }
  }

  async function initData(): Promise<void> {
    videoList.value = []
    appVideoList.value = []
    APP_LOAD_BATCHES.value = 1
    consecutiveEmptyLoads.value = 0
    appConsecutiveEmptyLoads.value = 0
    requestFailed.value = false
    await getData()
  }

  function handleLoadMore(): void {
    if (isLoading.value || noMoreContent.value || isRecursiveLoading.value)
      return
    if (settings.value.recommendationMode === 'app') {
      APP_LOAD_BATCHES.value = 1
      scrollLoadStartLength.value = appVideoList.value.length
    }
    getData()
  }

  return {
    videoList,
    appVideoList,
    isLoading,
    requestFailed,
    needToLoginFirst,
    noMoreContent,
    refreshIdx,
    consecutiveEmptyLoads,
    appConsecutiveEmptyLoads,
    isRecursiveLoading,
    scrollLoadStartLength,
    APP_LOAD_BATCHES,
    error,
    getData,
    initData,
    handleLoadMore,
  }
}

export function _resetForTest() {
  videoList.value = []
  appVideoList.value = []
  isLoading.value = false
  requestFailed.value = false
  needToLoginFirst.value = false
  noMoreContent.value = false
  refreshIdx.value = 1
  consecutiveEmptyLoads.value = 0
  appConsecutiveEmptyLoads.value = 0
  isRecursiveLoading.value = false
  scrollLoadStartLength.value = 0
  APP_LOAD_BATCHES.value = 1
  error.value = null
}
