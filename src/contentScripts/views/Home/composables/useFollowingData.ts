import { ref } from 'vue'

import type { Author, Video } from '~/components/VideoCard/types'
import { settings } from '~/logic'
import type { FollowingLiveResult, List as FollowingLiveItem } from '~/models/live/getFollowingLiveList'
import type { DataItem as MomentItem, MomentResult } from '~/models/moment/moment'
import { BadgeText } from '~/models/moment/moment'
import api from '~/utils/api'
import { calcTimeSince, parseStatNumber } from '~/utils/dataFormatter'
import { decodeHtmlEntities } from '~/utils/htmlDecode'

export { calcTimeSince }

export interface UploaderInfo {
  mid: number
  name: string
  face: string
  hasUpdate: boolean
  lastUpdateTime: number
}

export interface VideoElement {
  uniqueId: string
  bvid?: string
  item?: MomentItem
  liveItem?: FollowingLiveItem
  authorList?: Author[]
  displayData?: Video
  isLive?: boolean
}

// Cache keys
const VIEWED_UPLOADERS_KEY = 'bewlycat_moments_viewed_uploaders'
const UPLOADER_TIMES_CACHE_KEY = 'bewlycat_uploader_latest_times'
const CACHE_EXPIRY_DAYS = 1
const UPLOADER_BLACKLIST_KEY = 'bewlycat_uploader_blacklist'

// 模块作用域单例状态
const videoList = ref<VideoElement[]>([])
const uploaderList = ref<UploaderInfo[]>([])
const selectedUploader = ref<number | null>(null)
const previousSelectedUploader = ref<number | null>(null)
const isLoadingUploaderTimes = ref<boolean>(false)
const loadedUploaderTimesCount = ref<number>(0)
const selectionToken = ref<number>(0)
const liveListLoaded = ref<boolean>(false)
const isLoading = ref<boolean>(false)
const requestFailed = ref<boolean>(false)
const noMoreContent = ref<boolean>(false)
const needToLoginFirst = ref<boolean>(false)
const allViewOffset = ref<string>('')
const allViewUpdateBaseline = ref<string>('')
const userMomentsOffset = ref<string>('')
const currentUserMid = ref<number>(0)
const error = ref<Error | null>(null)

// ---- Cache helpers ----

interface UploaderCache {
  time: number
  cachedAt: number
  updateInterval?: number
  predictedNextUpdate?: number
  lastSyncTime?: number
  lastViewedTime?: number
}

function getViewedUploaders(): Record<number, number> {
  try {
    const data = localStorage.getItem(VIEWED_UPLOADERS_KEY)
    return data ? JSON.parse(data) : {}
  }
  catch {
    return {}
  }
}

function calculateHasUpdate(lastUpdateTime: number, viewedTime: number): boolean {
  const now = Date.now()
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000
  return lastUpdateTime > viewedTime && (now - lastUpdateTime <= THREE_DAYS)
}

function markUploaderAsViewed(mid: number, updateTime?: number) {
  const viewed = getViewedUploaders()
  const uploader = uploaderList.value.find(u => u.mid === mid)
  const timeToMark = updateTime || (uploader?.lastUpdateTime) || Date.now()
  viewed[mid] = timeToMark
  localStorage.setItem(VIEWED_UPLOADERS_KEY, JSON.stringify(viewed))
  if (uploader) {
    uploader.hasUpdate = false
  }
  console.log(`[Following] Marked UP ${mid} as viewed at ${new Date(timeToMark).toLocaleString()}`)
}

function getCachedUploaderTimes(): Record<number, UploaderCache> {
  try {
    const data = localStorage.getItem(UPLOADER_TIMES_CACHE_KEY)
    if (!data)
      return {}
    const cache = JSON.parse(data)
    const now = Date.now()
    const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    const validCache: Record<number, UploaderCache> = {}
    for (const [mid, value] of Object.entries(cache)) {
      if (now - (value as any).cachedAt < expiryMs) {
        validCache[Number(mid)] = value as any
      }
    }
    return validCache
  }
  catch {
    return {}
  }
}

function cacheUploaderData(mid: number, data: Partial<UploaderCache>) {
  try {
    const cache = getCachedUploaderTimes()
    cache[mid] = {
      ...(cache[mid] || {}),
      ...data,
      cachedAt: Date.now(),
      lastSyncTime: Date.now(),
    }
    localStorage.setItem(UPLOADER_TIMES_CACHE_KEY, JSON.stringify(cache))
  }
  catch (err) {
    console.error('[Following] Failed to cache uploader data:', err)
  }
}

function calculateUpdateInterval(videoTimes: number[]): number | undefined {
  if (videoTimes.length < 2)
    return undefined
  const intervals: number[] = []
  for (let i = 1; i < Math.min(videoTimes.length, 10); i++) {
    const interval = videoTimes[i - 1] - videoTimes[i]
    if (interval > 0)
      intervals.push(interval)
  }
  if (intervals.length === 0)
    return undefined
  intervals.sort((a, b) => a - b)
  const mid = Math.floor(intervals.length / 2)
  return intervals.length % 2 === 0
    ? (intervals[mid - 1] + intervals[mid]) / 2
    : intervals[mid]
}

function calculateSyncInterval(updateInterval: number): number {
  const HOUR = 60 * 60 * 1000
  const DAY = 24 * HOUR
  const WEEK = 7 * DAY
  const MONTH = 30 * DAY
  if (updateInterval <= DAY)
    return HOUR
  if (updateInterval <= WEEK)
    return DAY
  if (updateInterval <= MONTH)
    return WEEK
  return 2 * WEEK
}

function shouldSync(cache: UploaderCache | undefined, now: number): boolean {
  if (!cache)
    return true
  if (cache.predictedNextUpdate && cache.updateInterval) {
    const timeUntilPredicted = cache.predictedNextUpdate - now
    const window = cache.updateInterval * 0.2
    if (Math.abs(timeUntilPredicted) <= window) {
      const lastSync = cache.lastSyncTime || cache.cachedAt
      const timeSinceSync = now - lastSync
      return timeSinceSync > 60 * 60 * 1000
    }
  }
  if (cache.updateInterval) {
    const syncInterval = calculateSyncInterval(cache.updateInterval)
    const lastSync = cache.lastSyncTime || cache.cachedAt
    const timeSinceSync = now - lastSync
    return timeSinceSync > syncInterval
  }
  const lastSync = cache.lastSyncTime || cache.cachedAt
  return (now - lastSync) > 12 * 60 * 60 * 1000
}

function getBlacklistedUploaders(): Set<number> {
  try {
    const data = localStorage.getItem(UPLOADER_BLACKLIST_KEY)
    return data ? new Set(JSON.parse(data)) : new Set()
  }
  catch {
    return new Set()
  }
}

function addToBlacklist(mid: number) {
  try {
    const blacklist = getBlacklistedUploaders()
    blacklist.add(mid)
    localStorage.setItem(UPLOADER_BLACKLIST_KEY, JSON.stringify([...blacklist]))
    console.log(`[Following] Added UP ${mid} to blacklist`)
  }
  catch (err) {
    console.error('[Following] Failed to add to blacklist:', err)
  }
}

function removeFromBlacklist(mid: number) {
  try {
    const blacklist = getBlacklistedUploaders()
    if (blacklist.has(mid)) {
      blacklist.delete(mid)
      localStorage.setItem(UPLOADER_BLACKLIST_KEY, JSON.stringify([...blacklist]))
      console.log(`[Following] Removed UP ${mid} from blacklist`)
    }
  }
  catch (err) {
    console.error('[Following] Failed to remove from blacklist:', err)
  }
}

function shouldBeBlacklisted(uploader: UploaderInfo): boolean {
  const inactiveDays = settings.value.followingInactiveDays
  const inactiveThresholdMs = inactiveDays * 24 * 60 * 60 * 1000
  const now = Date.now()
  return (now - uploader.lastUpdateTime) > inactiveThresholdMs
}

function isChargingVideo(item: MomentItem): boolean {
  const badgeText = item.modules?.module_dynamic?.major?.archive?.badge?.text
  return badgeText === BadgeText.充电专属
}

function isDynamicVideo(item: MomentItem): boolean {
  const badgeText = item.modules?.module_dynamic?.major?.archive?.badge?.text
  return badgeText === BadgeText.动态视频
}

function shouldFilterVideo(item: MomentItem): boolean {
  if (settings.value.followingFilterChargingVideos && isChargingVideo(item))
    return true
  if (settings.value.followingFilterDynamicVideos && isDynamicVideo(item))
    return true
  return false
}

function sortUploaderList(excludeMid: number | null = null) {
  let excludedUploader: UploaderInfo | undefined
  let excludedIndex = -1

  if (excludeMid !== null) {
    excludedIndex = uploaderList.value.findIndex(u => u.mid === excludeMid)
    if (excludedIndex !== -1) {
      excludedUploader = uploaderList.value[excludedIndex]
      uploaderList.value.splice(excludedIndex, 1)
    }
  }

  const blacklist = getBlacklistedUploaders()
  uploaderList.value.sort((a, b) => {
    const aIsBlacklisted = blacklist.has(a.mid)
    const bIsBlacklisted = blacklist.has(b.mid)
    if (aIsBlacklisted !== bIsBlacklisted)
      return aIsBlacklisted ? 1 : -1
    return b.lastUpdateTime - a.lastUpdateTime
  })

  if (excludedUploader && excludedIndex !== -1) {
    uploaderList.value.splice(excludedIndex, 0, excludedUploader)
  }
}

function updateUploaderStatus() {
  const viewed = getViewedUploaders()
  uploaderList.value = uploaderList.value.map((uploader) => {
    const viewedTime = viewed[uploader.mid] || 0
    return {
      ...uploader,
      hasUpdate: calculateHasUpdate(uploader.lastUpdateTime, viewedTime),
    }
  })
  sortUploaderList(null)
}

// ---- Data fetch helpers ----

function mapLiveItemToVideo(liveItem: FollowingLiveItem): Video {
  return {
    id: liveItem.roomid,
    title: decodeHtmlEntities(liveItem.title),
    cover: liveItem.room_cover,
    author: {
      name: decodeHtmlEntities(liveItem.uname),
      authorFace: liveItem.face,
      mid: liveItem.uid,
    },
    viewStr: liveItem.text_small,
    tag: decodeHtmlEntities(liveItem.area_name_v2),
    roomid: liveItem.roomid,
    liveStatus: liveItem.live_status,
    threePointV2: [],
  }
}

function mapMomentItemToVideo(item?: MomentItem, authors?: Author[]): Video | undefined {
  if (!item)
    return undefined
  const archive = item.modules?.module_dynamic?.major?.archive
  if (!archive)
    return undefined
  const stat = archive.stat
  const likeCount = item.modules?.module_stat?.like?.count
  const decodedAuthors = authors?.map(author => ({
    ...author,
    name: decodeHtmlEntities(author.name),
  }))
  const authorValue = decodedAuthors && decodedAuthors.length > 0
    ? (decodedAuthors.length === 1 ? decodedAuthors[0] : decodedAuthors)
    : undefined
  const isCollaboration = authors && authors.length > 1
  const badge = archive.badge?.text && archive.badge.text !== '投稿视频'
    ? {
        bgColor: archive.badge.bg_color,
        color: archive.badge.color,
        iconUrl: archive.badge.icon_url || undefined,
        text: decodeHtmlEntities(archive.badge.text),
      }
    : undefined
  const id = Number.parseInt(archive.aid, 10)
  return {
    id: Number.isNaN(id) ? 0 : id,
    durationStr: archive.duration_text,
    title: decodeHtmlEntities(archive.title),
    desc: decodeHtmlEntities(archive.desc),
    cover: archive.cover,
    author: authorValue,
    view: parseStatNumber(stat?.play),
    viewStr: stat?.play,
    danmaku: parseStatNumber(stat?.danmaku),
    danmakuStr: stat?.danmaku,
    like: typeof likeCount === 'number' ? likeCount : parseStatNumber(stat?.like),
    likeStr: stat?.like_str ?? stat?.like,
    capsuleText: decodeHtmlEntities(item.modules?.module_author?.pub_time?.trim() || undefined),
    publishedTimestamp: item.modules?.module_author?.pub_ts,
    bvid: archive.bvid,
    badge,
    tag: isCollaboration ? '联合投稿' : undefined,
    threePointV2: [],
  }
}

const OFFLINE_LIVE_TEXT = /未开播|休息|离线|下播|轮播|回放/

function isLiveStreamingItem(liveItem: FollowingLiveItem): boolean {
  const liveStatus = Number(liveItem.live_status)
  if (liveStatus !== 1)
    return false
  const statusText = (liveItem.text_small ?? '').trim()
  if (statusText && OFFLINE_LIVE_TEXT.test(statusText))
    return false
  return true
}

async function getCurrentUserInfo(): Promise<number> {
  try {
    const response: any = await api.user.getUserInfo()
    if (response.code === 0 && response.data?.mid) {
      currentUserMid.value = response.data.mid
      return response.data.mid
    }
  }
  catch (err) {
    console.error('[Following] Failed to get current user info:', err)
  }
  return 0
}

async function loadFollowingLiveList(): Promise<VideoElement[]> {
  if (!settings.value.followingTabShowLivestreamingVideos)
    return []
  try {
    console.log('[Following] Loading following live list...')
    const response: FollowingLiveResult = await api.live.getFollowingLiveList({
      page: 1,
      page_size: 30,
    })
    if (response.code === 0 && response.data.list) {
      const liveItems = response.data.list
        .filter((liveItem: FollowingLiveItem) => isLiveStreamingItem(liveItem))
        .map((liveItem: FollowingLiveItem) => ({
          uniqueId: `live-${liveItem.roomid}`,
          liveItem,
          displayData: mapLiveItemToVideo(liveItem),
          isLive: true,
        }))
      console.log(`[Following] Loaded ${liveItems.length} live streams (filtered from ${response.data.list.length} total)`)
      return liveItems
    }
  }
  catch (err) {
    console.error('[Following] Failed to load live list:', err)
  }
  return []
}

async function loadSingleUploaderTime(mid: number, retryCount: number = 0): Promise<void> {
  const MAX_RETRIES = 2
  try {
    const response: MomentResult = await api.moment.getUserMoments({
      host_mid: mid.toString(),
      offset: '',
      features: 'itemOpusStyle',
    })
    if (response.code === 0 && response.data.items) {
      const videoItems: { item: MomentItem, time: number }[] = []
      for (const item of response.data.items) {
        if (item.modules?.module_dynamic?.major?.archive && item.modules?.module_author?.pub_ts) {
          videoItems.push({ item, time: item.modules.module_author.pub_ts * 1000 })
          if (videoItems.length >= 10)
            break
        }
      }
      if (videoItems.length > 0) {
        const uploader = uploaderList.value.find(u => u.mid === mid)
        if (uploader) {
          const videoTimes = videoItems.map(v => v.time)
          const latestTime = videoItems.length === 1
            ? videoItems[0].time
            : Math.max(videoItems[0].time, videoItems[1].time)
          const cachedTimes = getCachedUploaderTimes()
          const cachedTime = cachedTimes[mid]?.time || 0
          if (latestTime >= cachedTime) {
            uploader.lastUpdateTime = latestTime
            loadedUploaderTimesCount.value++
            const updateInterval = calculateUpdateInterval(videoTimes)
            const predictedNextUpdate = updateInterval ? latestTime + updateInterval : undefined
            cacheUploaderData(mid, { time: latestTime, updateInterval, predictedNextUpdate })
            const viewed = getViewedUploaders()
            const viewedTime = viewed[mid] || 0
            uploader.hasUpdate = calculateHasUpdate(uploader.lastUpdateTime, viewedTime)
            console.log(`[Following] Updated time for UP ${mid} (${loadedUploaderTimesCount.value}/${uploaderList.value.length})`)
            if (settings.value.enableFollowingInactiveBlacklist && shouldBeBlacklisted(uploader))
              addToBlacklist(mid)
            sortUploaderList(selectedUploader.value)
          }
          else {
            console.log(`[Following] Skipped updating UP ${mid}: cached time is newer`)
          }
        }
      }
      else {
        const uploader = uploaderList.value.find(u => u.mid === mid)
        if (uploader && settings.value.enableFollowingInactiveBlacklist) {
          addToBlacklist(mid)
          console.log(`[Following] No video data for UP ${mid}, added to blacklist`)
        }
      }
    }
    else if (response.code !== 0) {
      console.log(`[Following] API error (code ${response.code}) for UP ${mid}, keeping cached data`)
    }
  }
  catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    if (errorMessage.includes('风控') && retryCount < MAX_RETRIES) {
      const retryDelay = (retryCount + 1) * 3000
      console.warn(`[Following] Rate limited for UP ${mid}, retrying in ${retryDelay / 1000}s...`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return loadSingleUploaderTime(mid, retryCount + 1)
    }
    console.error(`[Following] Failed to load time for UP ${mid}:`, err, '- keeping cached data')
  }
}

async function startLoadingUploaderTimesInBackground(isUserTriggered: boolean = false) {
  if (isLoadingUploaderTimes.value)
    return
  isLoadingUploaderTimes.value = true
  loadedUploaderTimesCount.value = 0
  const INITIAL_DELAY = 2000 + Math.random() * 1000
  console.log(`[Following] Will start smart sync in ${Math.round(INITIAL_DELAY / 1000)}s...`)
  await new Promise(resolve => setTimeout(resolve, INITIAL_DELAY))
  console.log('[Following] Starting smart background sync...')
  const cachedTimes = getCachedUploaderTimes()
  const blacklist = getBlacklistedUploaders()
  const now = Date.now()
  interface SyncItem {
    mid: number
    priority: number
    reason: string
  }
  const syncQueue: SyncItem[] = []
  if (selectedUploader.value !== null && !blacklist.has(selectedUploader.value)) {
    syncQueue.push({ mid: selectedUploader.value, priority: 1000, reason: 'selected' })
  }
  for (const uploader of uploaderList.value) {
    if (uploader.mid === selectedUploader.value)
      continue
    if (blacklist.has(uploader.mid))
      continue
    const cache = cachedTimes[uploader.mid]
    if (isUserTriggered) {
      syncQueue.push({ mid: uploader.mid, priority: 500, reason: 'user-triggered' })
      continue
    }
    if (!shouldSync(cache, now))
      continue
    let priority = 100
    let reason = 'need-sync'
    if (!cache) {
      priority = 800
      reason = 'no-cache'
    }
    else if (cache.predictedNextUpdate && cache.updateInterval) {
      const timeUntilPredicted = cache.predictedNextUpdate - now
      const window = cache.updateInterval * 0.2
      if (Math.abs(timeUntilPredicted) <= window) {
        priority = 900
        reason = 'prediction-window'
      }
    }
    syncQueue.push({ mid: uploader.mid, priority, reason })
  }
  syncQueue.sort((a, b) => b.priority - a.priority)
  console.log(`[Following] Smart sync queue: ${syncQueue.length} uploaders`)
  const MAX_CONCURRENT = 2
  const MIN_DELAY = 1200
  const MAX_DELAY = 2000
  let activeRequests = 0
  let queueIndex = 0
  const randomDelay = () => {
    const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)
    return new Promise(resolve => setTimeout(resolve, delay))
  }
  const processQueue = async () => {
    while (queueIndex < syncQueue.length) {
      // eslint-disable-next-line no-unmodified-loop-condition
      while (activeRequests >= MAX_CONCURRENT) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      const item = syncQueue[queueIndex++]
      activeRequests++
      loadSingleUploaderTime(item.mid).finally(() => {
        activeRequests--
      })
      await randomDelay()
    }
    // eslint-disable-next-line no-unmodified-loop-condition
    while (activeRequests > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  await processQueue()
  sortUploaderList(selectedUploader.value)
  isLoadingUploaderTimes.value = false
  console.log('[Following] Finished loading all uploader times')
}

async function loadFollowingList(): Promise<void> {
  console.log('[Following] Loading all following list...')
  if (!currentUserMid.value) {
    const mid = await getCurrentUserInfo()
    if (!mid) {
      needToLoginFirst.value = true
      return
    }
  }
  try {
    let currentPage = 1
    const pageSize = 50
    let hasMore = true
    const viewed = getViewedUploaders()
    const cachedTimes = getCachedUploaderTimes()
    while (hasMore) {
      console.log(`[Following] Loading following list page ${currentPage}...`)
      const response: any = await api.user.getUserFollowings({
        vmid: currentUserMid.value.toString(),
        ps: pageSize,
        pn: currentPage,
      })
      console.log(`[Following] Following list page ${currentPage} response:`, response.code, 'count:', response.data?.list?.length)
      if (response.code === -101) {
        needToLoginFirst.value = true
        return
      }
      if (response.code === 0 && response.data?.list) {
        const followings = response.data.list
        const newUploaders = followings.map((user: any) => {
          const cachedTime = cachedTimes[user.mid]
          const lastUpdateTime = cachedTime ? cachedTime.time : user.mtime * 1000
          const viewedTime = viewed[user.mid] || 0
          return {
            mid: user.mid,
            name: user.uname,
            face: user.face,
            hasUpdate: calculateHasUpdate(lastUpdateTime, viewedTime),
            lastUpdateTime,
          }
        })
        uploaderList.value = [...uploaderList.value, ...newUploaders]
        updateUploaderStatus()
        console.log(`[Following] Page ${currentPage} loaded. Current total:`, uploaderList.value.length)
        const total = response.data.total
        if (uploaderList.value.length >= total || followings.length < pageSize) {
          hasMore = false
          console.log('[Following] All followings loaded. Total:', uploaderList.value.length)
        }
        else {
          currentPage++
        }
      }
      else {
        hasMore = false
        console.log('[Following] API returned error code:', response.code)
      }
    }
    if (uploaderList.value.length > 0) {
      console.log('[Following] Successfully loaded', uploaderList.value.length, 'followings')
      startLoadingUploaderTimesInBackground(false)
    }
  }
  catch (err) {
    console.error('[Following] Failed to load following list:', err)
  }
}

async function loadAllViewVideos(maxPages: number = 3, token?: number): Promise<void> {
  console.log('[Following] Loading ALL view videos (max', maxPages, 'pages)...')
  isLoading.value = true
  requestFailed.value = false
  const uploaderLatestTimes = new Map<number, number>()
  try {
    if (!allViewOffset.value && !liveListLoaded.value && settings.value.followingTabShowLivestreamingVideos) {
      const liveItems = await loadFollowingLiveList()
      if (liveItems.length > 0) {
        videoList.value = [...liveItems, ...videoList.value]
      }
      liveListLoaded.value = true
    }
    let tempOffset = allViewOffset.value || undefined
    let pageCount = 0
    while (pageCount < maxPages) {
      pageCount++
      console.log(`[Following] Loading ALL view page ${pageCount}...`)
      const response: MomentResult = await api.moment.getMoments({
        type: 'video',
        offset: tempOffset,
        update_baseline: allViewUpdateBaseline.value || undefined,
      })
      if (token !== undefined && token !== selectionToken.value) {
        console.log('[Following] Selection changed during load, aborting...')
        return
      }
      if (response.code === -101) {
        needToLoginFirst.value = true
        console.log('[Following] Need to login first')
        return
      }
      if (response.code === 0) {
        const newOffset = response.data.offset
        allViewUpdateBaseline.value = response.data.update_baseline
        if (!response.data.items || response.data.items.length === 0) {
          noMoreContent.value = true
          console.log('[Following] No items returned in ALL view')
          break
        }
        if (newOffset === '0' || newOffset === tempOffset) {
          noMoreContent.value = true
          console.log('[Following] No more content in ALL view')
          break
        }
        else {
          tempOffset = newOffset
          allViewOffset.value = newOffset
        }
        response.data.items.forEach((item: MomentItem) => {
          if (shouldFilterVideo(item))
            return
          const authors: Author[] = []
          if ((item.modules?.module_dynamic?.major?.archive?.stat as any)?.coop_num) {
            ;(item.modules.module_dynamic.major.archive as any).coop_info?.forEach((coop: any) => {
              authors.push({ name: coop.name, authorFace: coop.face, mid: coop.mid })
            })
          }
          else {
            authors.push({
              name: item.modules?.module_author?.name,
              authorFace: item.modules?.module_author?.face,
              mid: item.modules?.module_author?.mid,
            })
          }
          const pubTs = item.modules?.module_author?.pub_ts
          if (pubTs) {
            const videoTime = pubTs * 1000
            authors.forEach((author) => {
              if (author.mid) {
                const currentLatest = uploaderLatestTimes.get(author.mid) || 0
                if (videoTime > currentLatest)
                  uploaderLatestTimes.set(author.mid, videoTime)
              }
            })
          }
          videoList.value.push({
            uniqueId: `following-all-${item.id_str}`,
            bvid: item.modules?.module_dynamic?.major?.archive?.bvid,
            item,
            authorList: authors,
            displayData: mapMomentItemToVideo(item, authors),
          })
        })
        console.log(`[Following] ALL view page ${pageCount} loaded. Total videos:`, videoList.value.length)
      }
      else {
        console.error('[Following] API returned error code:', response.code)
        requestFailed.value = true
        noMoreContent.value = true
        break
      }
    }
    console.log('[Following] ALL view loading complete. Total:', videoList.value.length, 'videos')
    if (token !== undefined && token !== selectionToken.value) {
      console.log('[Following] Selection changed during cache update, aborting...')
      return
    }
    let updatedCount = 0
    let removedFromBlacklistCount = 0
    let markedAsViewedCount = 0
    uploaderLatestTimes.forEach((time, mid) => {
      const uploader = uploaderList.value.find(u => u.mid === mid)
      if (uploader) {
        const cachedTimes = getCachedUploaderTimes()
        const cachedTime = cachedTimes[mid]?.time || 0
        if (time > cachedTime) {
          uploader.lastUpdateTime = time
          cacheUploaderData(mid, { time, lastViewedTime: Date.now() })
          updatedCount++
        }
        const viewed = getViewedUploaders()
        const lastViewedTime = viewed[mid] || 0
        if (time >= uploader.lastUpdateTime && time > lastViewedTime) {
          markUploaderAsViewed(mid, time)
          markedAsViewedCount++
        }
        else {
          uploader.hasUpdate = calculateHasUpdate(uploader.lastUpdateTime, lastViewedTime)
        }
        const blacklist = getBlacklistedUploaders()
        if (blacklist.has(mid)) {
          removeFromBlacklist(mid)
          removedFromBlacklistCount++
        }
      }
    })
    if (updatedCount > 0)
      console.log(`[Following] Updated ${updatedCount} uploader times from ALL view`)
    if (markedAsViewedCount > 0)
      console.log(`[Following] Marked ${markedAsViewedCount} uploaders as viewed from ALL view`)
    if (removedFromBlacklistCount > 0)
      console.log(`[Following] Removed ${removedFromBlacklistCount} uploaders from blacklist`)
    if (updatedCount > 0 || removedFromBlacklistCount > 0 || markedAsViewedCount > 0) {
      if (!isLoadingUploaderTimes.value)
        sortUploaderList(selectedUploader.value)
    }
    if (videoList.value.length === 0)
      noMoreContent.value = true
  }
  catch (err) {
    console.error('[Following] Failed to load ALL view:', err)
    requestFailed.value = true
    noMoreContent.value = true
  }
  finally {
    if (token === undefined || token === selectionToken.value) {
      isLoading.value = false
    }
  }
}

async function loadUserMoments(mid: number, maxPages: number = 3, token?: number): Promise<void> {
  console.log('[Following] Loading moments for UP', mid, '(max', maxPages, 'pages)...')
  isLoading.value = true
  requestFailed.value = false
  const allVideoTimes: number[] = []
  try {
    let tempOffset = userMomentsOffset.value || undefined
    let pageCount = 0
    while (pageCount < maxPages) {
      pageCount++
      console.log(`[Following] Loading user moments page ${pageCount}...`)
      const response: MomentResult = await api.moment.getUserMoments({
        host_mid: mid.toString(),
        offset: tempOffset,
        features: 'itemOpusStyle',
      })
      if (token !== undefined && token !== selectionToken.value) {
        console.log('[Following] Selection changed during load, aborting...')
        return
      }
      console.log('[Following] API Response:', response)
      if (response.code === -101) {
        needToLoginFirst.value = true
        console.log('[Following] Need to login first')
        return
      }
      if (response.code === 0) {
        const newOffset = response.data.offset
        if (newOffset === '0' || newOffset === tempOffset || !response.data.items || response.data.items.length === 0) {
          noMoreContent.value = true
          console.log('[Following] No more content for this UP')
          break
        }
        else {
          tempOffset = newOffset
          userMomentsOffset.value = newOffset
        }
        const allVideoItems: { item: MomentItem, time: number }[] = []
        response.data.items.forEach((item: MomentItem) => {
          if (!item.modules?.module_dynamic?.major?.archive)
            return
          if (shouldFilterVideo(item))
            return
          const authors: Author[] = []
          if ((item.modules?.module_dynamic?.major?.archive?.stat as any)?.coop_num) {
            ;(item.modules.module_dynamic.major.archive as any).coop_info?.forEach((coop: any) => {
              authors.push({ name: coop.name, authorFace: coop.face, mid: coop.mid })
            })
          }
          else {
            authors.push({
              name: item.modules?.module_author?.name,
              authorFace: item.modules?.module_author?.face,
              mid: item.modules?.module_author?.mid,
            })
          }
          const displayData = mapMomentItemToVideo(item, authors)
          if (displayData) {
            const time = item.modules.module_author.pub_ts * 1000
            videoList.value.push({
              uniqueId: `user-moment-${item.id_str}`,
              bvid: item.modules?.module_dynamic?.major?.archive?.bvid,
              item,
              authorList: authors,
              displayData,
            })
            allVideoItems.push({ item, time })
            allVideoTimes.push(time)
          }
        })
        console.log(`[Following] User moments page ${pageCount} loaded. Total:`, videoList.value.length)
      }
      else {
        console.error('[Following] API returned error code:', response.code)
        requestFailed.value = true
        noMoreContent.value = true
        break
      }
    }
    if (allVideoTimes.length > 0) {
      if (token !== undefined && token !== selectionToken.value) {
        console.log('[Following] Selection changed during cache update, aborting...')
        return
      }
      const uploader = uploaderList.value.find(u => u.mid === mid)
      if (uploader) {
        allVideoTimes.sort((a, b) => b - a)
        const latestTime = allVideoTimes.length === 1
          ? allVideoTimes[0]
          : Math.max(allVideoTimes[0], allVideoTimes[1])
        uploader.lastUpdateTime = latestTime
        const updateInterval = calculateUpdateInterval(allVideoTimes)
        const predictedNextUpdate = updateInterval ? latestTime + updateInterval : undefined
        cacheUploaderData(mid, { time: latestTime, updateInterval, predictedNextUpdate, lastViewedTime: Date.now() })
        markUploaderAsViewed(mid, latestTime)
        console.log(`[Following] Updated data for UP ${mid}: time=${new Date(latestTime).toLocaleString()}`)
      }
    }
    console.log('[Following] User moments loading complete. Total:', videoList.value.length, 'videos')
    if (videoList.value.length === 0)
      noMoreContent.value = true
  }
  catch (err) {
    console.error('[Following] Failed to load user moments:', err)
    requestFailed.value = true
    noMoreContent.value = true
  }
  finally {
    if (token === undefined || token === selectionToken.value) {
      isLoading.value = false
    }
  }
}

export function useFollowingData() {
  function selectUploader(mid: number | null, scrollViewport?: HTMLElement | null) {
    console.log('[Following] Selecting uploader:', mid === null ? 'All' : mid)
    const currentToken = ++selectionToken.value
    if (scrollViewport) {
      const scrollTarget = settings.value.useSearchPageModeOnHomePage ? 510 : 0
      scrollViewport.scrollTop = scrollTarget
    }
    videoList.value = []
    noMoreContent.value = false
    if (mid === null) {
      console.log('[Following] Switching to All view')
      if (previousSelectedUploader.value !== null)
        sortUploaderList(null)
      selectedUploader.value = null
      previousSelectedUploader.value = null
      allViewOffset.value = ''
      allViewUpdateBaseline.value = ''
      liveListLoaded.value = false
      loadAllViewVideos(3, currentToken)
    }
    else {
      console.log('[Following] Selecting uploader:', mid)
      markUploaderAsViewed(mid)
      const blacklist = getBlacklistedUploaders()
      if (blacklist.has(mid))
        removeFromBlacklist(mid)
      if (previousSelectedUploader.value !== null && previousSelectedUploader.value !== mid)
        sortUploaderList(mid)
      selectedUploader.value = mid
      previousSelectedUploader.value = mid
      userMomentsOffset.value = ''
      const uploader = uploaderList.value.find(u => u.mid === mid)
      if (uploader && uploader.lastUpdateTime && uploader.lastUpdateTime < Date.now() - 365 * 24 * 60 * 60 * 1000)
        loadSingleUploaderTime(mid)
      loadUserMoments(mid, 3, currentToken)
    }
  }

  async function handleLoadMore() {
    if (isLoading.value || noMoreContent.value)
      return
    console.log('[Following] Loading more...')
    if (selectedUploader.value === null)
      await loadAllViewVideos(1, selectionToken.value)
    else
      await loadUserMoments(selectedUploader.value, 1, selectionToken.value)
  }

  function initData(scrollViewport?: HTMLElement | null) {
    console.log('[Following] Initializing...')
    selectionToken.value++
    const currentSelectedUploader = selectedUploader.value
    videoList.value = []
    allViewOffset.value = ''
    allViewUpdateBaseline.value = ''
    userMomentsOffset.value = ''
    noMoreContent.value = false
    needToLoginFirst.value = false
    requestFailed.value = false
    liveListLoaded.value = false
    if (currentSelectedUploader !== null) {
      console.log('[Following] Refreshing moments for UP', currentSelectedUploader)
      loadUserMoments(currentSelectedUploader, 3, selectionToken.value)
    }
    else {
      if (uploaderList.value.length === 0) {
        isLoading.value = true
        loadFollowingList().then(() => {
          console.log('[Following] Following list loaded')
          selectUploader(null, scrollViewport)
        }).catch((err) => {
          console.error('[Following] Failed to initialize:', err)
          isLoading.value = false
        })
      }
      else {
        console.log('[Following] Refreshing ALL view')
        loadAllViewVideos(3, selectionToken.value)
      }
    }
  }

  return {
    videoList,
    uploaderList,
    selectedUploader,
    isLoading,
    requestFailed,
    noMoreContent,
    needToLoginFirst,
    isLoadingUploaderTimes,
    loadedUploaderTimesCount,
    error,
    initData,
    selectUploader,
    handleLoadMore,
    markUploaderAsViewed,
    getViewedUploaders,
    sortUploaderList,
    startLoadingUploaderTimesInBackground,
  }
}

export function _resetForTest() {
  videoList.value = []
  uploaderList.value = []
  selectedUploader.value = null
  previousSelectedUploader.value = null
  isLoadingUploaderTimes.value = false
  loadedUploaderTimesCount.value = 0
  selectionToken.value = 0
  liveListLoaded.value = false
  isLoading.value = false
  requestFailed.value = false
  noMoreContent.value = false
  needToLoginFirst.value = false
  allViewOffset.value = ''
  allViewUpdateBaseline.value = ''
  userMomentsOffset.value = ''
  currentUserMid.value = 0
  error.value = null
}
