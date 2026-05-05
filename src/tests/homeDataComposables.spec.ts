import { afterEach, describe, expect, it, vi } from 'vitest'

import { _resetForTest, useTrendingData } from '~/contentScripts/views/Home/composables/useTrendingData'

// Mock webextension-polyfill so api.ts / messaging can be imported in jsdom
vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({}),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}))

describe('useTrendingData (singleton)', () => {
  afterEach(() => _resetForTest())

  it('returns the same reactive items ref across calls (singleton)', () => {
    const a = useTrendingData()
    const b = useTrendingData()
    expect(a.items).toBe(b.items)
  })

  it('returns the same loading ref across calls (singleton)', () => {
    const a = useTrendingData()
    const b = useTrendingData()
    expect(a.loading).toBe(b.loading)
  })

  it('exposes load() with retry-able error state', async () => {
    const { error, load } = useTrendingData({ fetchTrending: () => Promise.reject(new Error('boom')) })
    await load()
    expect(error.value?.message).toBe('boom')
  })

  it('_resetForTest clears module state', async () => {
    const { items, load } = useTrendingData({
      fetchTrending: () => Promise.resolve({
        code: 0,
        data: {
          no_more: true,
          list: [{ aid: '1', bvid: 'BV1', title: 'T', pic: '', desc: '', duration: 0, pubdate: 0, owner: { name: 'U', face: '', mid: 1 }, stat: { view: 0, danmaku: 0, like: 0 }, rcmd_reason: { content: '' }, cid: 0 }],
        },
      } as any),
    })
    await load()
    expect(items.value.length).toBeGreaterThan(0)
    _resetForTest()
    expect(items.value.length).toBe(0)
  })
})
