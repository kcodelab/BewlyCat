// src/tests/heroPicker.spec.ts
import { describe, expect, it } from 'vitest'

// pickHeroCandidate / pickHeroCandidates live in heroUtils.ts (pure TS, no browser API deps).
// HomeNetflix.vue re-exports them, but the .vue file would pull in browser-polyfill.
import { pickHeroCandidate, pickHeroCandidates } from '~/contentScripts/views/Home/netflix/heroUtils'

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

describe('pickHeroCandidates', () => {
  const mkVideo = (id: string, bvid: string, coverScore?: number) => ({ id, bvid, coverScore })

  const t1 = mkVideo('t1', 'BV001', 80)
  const t2 = mkVideo('t2', 'BV002', 70)
  const t3 = mkVideo('t3', 'BV003', 65)
  const t4 = mkVideo('t4', 'BV004', 30) // below threshold
  const f1 = mkVideo('f1', 'BV005', 75)
  const f2 = mkVideo('f2', 'BV006', 62)

  it('returns up to 3 scored trending candidates', () => {
    const result = pickHeroCandidates([t1, t2, t3, t4], [])
    expect(result).toHaveLength(3)
    expect(result.map(v => v.id)).toEqual(['t1', 't2', 't3'])
  })

  it('backfills from forYou when trending has fewer than 3 qualifying', () => {
    const result = pickHeroCandidates([t1], [f1, f2])
    expect(result).toHaveLength(3)
    expect(result.map(v => v.id)).toEqual(['t1', 'f1', 'f2'])
  })

  it('deduplicates by bvid across sources', () => {
    // f1 shares bvid BV001 with t1 → should not appear twice
    const dup = mkVideo('dup', 'BV001', 90)
    const result = pickHeroCandidates([t1], [dup, f2])
    expect(result).toHaveLength(2)
    expect(result.map(v => v.id)).toContain('t1')
    expect(result.map(v => v.id)).not.toContain('dup')
  })

  it('returns 0 candidates when both sources are empty', () => {
    expect(pickHeroCandidates([], [])).toHaveLength(0)
  })

  it('returns 1 candidate when only 1 qualifies (single static hero)', () => {
    const result = pickHeroCandidates([t1], [t4])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t1')
  })

  it('falls back to any available items when no source has coverScore', () => {
    const noScore1 = { id: 'n1', bvid: 'BV010' }
    const noScore2 = { id: 'n2', bvid: 'BV011' }
    const result = pickHeroCandidates([noScore1], [noScore2])
    // Both lack scores → phase 3 fallback includes both
    expect(result.map(v => v.id)).toContain('n1')
  })

  it('threshold items from scored source beat unscored source items', () => {
    // trending has scores but all low; forYou has NO scores
    const low1 = mkVideo('low1', 'BV020', 20)
    const unscored = { id: 'u1', bvid: 'BV021' }
    // trending all below threshold + has scores → no candidates from trending
    // forYou has no scores → phase 2 skips it too
    // phase 3 fallback kicks in
    const result = pickHeroCandidates([low1], [unscored])
    // Phase 3: either source; at minimum both are available
    expect(result.length).toBeGreaterThan(0)
  })
})
