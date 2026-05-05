// src/contentScripts/views/Home/composables/useHomeRowRegistry.ts
import type { HomeSubPage } from '../types'

export function buildNetflixHomeRows(visibility: { page: HomeSubPage, visible: boolean }[]) {
  const dynamic = visibility.filter(v => v.visible).map(v => ({
    key: v.page,
    page: v.page,
    kind: 'subpage' as const,
  }))
  return [
    { key: 'hero', kind: 'hero' as const },
    { key: 'continue-watching', kind: 'continue' as const },
    { key: 'top10', kind: 'top10' as const },
    ...dynamic,
  ]
}
