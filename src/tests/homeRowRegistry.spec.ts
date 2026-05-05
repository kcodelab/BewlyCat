// src/tests/homeRowRegistry.spec.ts
import { describe, expect, it } from 'vitest'

import { buildNetflixHomeRows } from '~/contentScripts/views/Home/composables/useHomeRowRegistry'
import { HomeSubPage } from '~/contentScripts/views/Home/types'

describe('netflix home row registry', () => {
  it('orders fixed rows ahead of subpage rows; respects user visibility + order', () => {
    const rows = buildNetflixHomeRows([
      { page: HomeSubPage.Trending, visible: true },
      { page: HomeSubPage.Live, visible: false },
      { page: HomeSubPage.ForYou, visible: true },
    ])
    expect(rows.map(r => r.key)).toEqual(['hero', 'continue-watching', 'top10', HomeSubPage.Trending, HomeSubPage.ForYou])
  })
})
