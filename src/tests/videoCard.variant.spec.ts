import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import VideoCard from '~/components/VideoCard/VideoCard.vue'
import { settings } from '~/logic'

// Mock webextension-polyfill so storage.ts / logic can be imported in jsdom
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

// Stub browser globals that jsdom doesn't have
vi.stubGlobal('matchMedia', (_query: string) => ({
  matches: false,
  media: _query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

// Mock vue-toastification
vi.mock('vue-toastification', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

// Mock composables that require browser context
vi.mock('~/composables/useAppProvider', () => ({
  useBewlyApp: () => ({
    mainAppRef: { value: document.body },
    openIframeDrawer: vi.fn(),
  }),
}))

vi.mock('~/composables/useVideoCardSharedStyles', () => ({
  useVideoCardSharedStyles: () => ({
    titleFontSizeClass: { value: '' },
    titleStyle: { value: {} },
    authorFontSizeClass: { value: '' },
    metaFontSizeClass: { value: '' },
  }),
}))

vi.mock('~/stores/topBarStore', () => ({
  useTopBarStore: () => ({
    isLogin: false,
    addedWatchLaterList: [],
    getAllWatchLaterList: vi.fn(),
  }),
}))

// Minimal i18n instance so $t calls in child components don't throw
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missing: (_locale, key) => key,
})

// Shared stub config: keep ALink as a passthrough (renders slot content)
// so VideoCardCover (and VideoCardPreview inside it) are actually mounted.
const globalStubs = {
  plugins: [i18n],
  stubs: {
    // Use slot-passthrough stub so child components inside ALink are rendered
    ALink: { template: '<a><slot /></a>' },
    LazyPicture: { template: '<img />' },
    VideoCardInfo: true,
    VideoCardContextMenu: true,
    Teleport: true,
  },
}

describe('videoCard variant', () => {
  const baseProps = { video: { id: 1, cover: '//x/a.jpg', title: 'T' } as any, showPreview: true }

  beforeEach(() => {
    // Enable preview so VideoCardPreview renders in grid mode
    settings.value.enableVideoPreview = true
  })

  it('renders preview component for grid variant', async () => {
    const w = mount(VideoCard, {
      props: baseProps,
      global: globalStubs,
    })
    // assert by component lookup, not html string
    expect(w.findComponent({ name: 'VideoCardPreview' }).exists()).toBe(true)
  })

  it('does NOT render preview component for netflix-row variant, even when showPreview=true', async () => {
    const w = mount(VideoCard, {
      props: { ...baseProps, variant: 'netflix-row' },
      global: globalStubs,
    })
    expect(w.findComponent({ name: 'VideoCardPreview' }).exists()).toBe(false)
  })

  it('default variant is grid (back-compat)', async () => {
    const w = mount(VideoCard, {
      props: baseProps,
      global: globalStubs,
    })
    expect(w.props('variant')).toBe('grid')
  })
})
