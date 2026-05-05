import { ref } from 'vue'

import type { HistoryResult, List as HistoryItem } from '~/models/history/history'
import api from '~/utils/api'

// 模块作用域单例状态
// useHistoryData 为 Task 6 ContinueWatchingRow 准备
// 本轮（Task 5）只创建文件和类型定义，不接入任何 SubPage
const items = ref<HistoryItem[]>([])
const loading = ref<boolean>(false)
const error = ref<Error | null>(null)
const noMoreContent = ref<boolean>(false)
let inflight: Promise<void> | null = null

interface Deps {
  fetchHistory: (params: { type: string, view_at: number }) => Promise<HistoryResult>
}

function defaultFetchHistory(params: { type: string, view_at: number }): Promise<HistoryResult> {
  return api.history.getHistoryList(params)
}

export function useHistoryData(override?: Partial<Deps>) {
  const effectiveDeps: Deps = { fetchHistory: defaultFetchHistory, ...override }

  async function load() {
    if (inflight)
      return inflight
    if (noMoreContent.value)
      return Promise.resolve()
    loading.value = true
    error.value = null
    inflight = (async () => {
      try {
        const viewAt = items.value.length > 0
          ? items.value[items.value.length - 1].view_at
          : 0
        const res: HistoryResult = await effectiveDeps.fetchHistory({
          type: 'all',
          view_at: viewAt,
        })
        if (res.code === 0) {
          if (Array.isArray(res.data.list) && res.data.list.length > 0)
            items.value = [...items.value, ...res.data.list]
          if (items.value.length !== 0 && res.data.list.length < 20)
            noMoreContent.value = true
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
    items.value = []
    noMoreContent.value = false
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
  noMoreContent.value = false
  inflight = null
}
