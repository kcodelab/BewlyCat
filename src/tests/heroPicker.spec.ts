// src/tests/heroPicker.spec.ts
import { describe, expect, it } from 'vitest'

// pickHeroCandidate lives in heroUtils.ts (pure TS, no browser API deps).
// HomeNetflix.vue re-exports it, but the .vue file would pull in browser-polyfill.
import { pickHeroCandidate } from '~/contentScripts/views/Home/netflix/heroUtils'

describe('pickHeroCandidate', () => {
  const lowQuality = { id: 'a', coverScore: 30 }
  const highQuality = { id: 'b', coverScore: 80 }
  const noScore = { id: 'c' }

  it('picks first trending item with coverScore >= threshold', () => {
    expect(pickHeroCandidate([lowQuality, highQuality], [])?.id).toBe('b')
  })
  it('falls back to forYou first item when trending all below threshold', () => {
    expect(pickHeroCandidate([lowQuality], [highQuality])?.id).toBe('b')
  })
  it('falls back to first trending item when no scores present', () => {
    expect(pickHeroCandidate([noScore], [])?.id).toBe('c')
  })
  it('returns null when both empty', () => {
    expect(pickHeroCandidate([], [])).toBeNull()
  })
})
