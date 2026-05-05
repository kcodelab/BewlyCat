// src/contentScripts/views/Home/netflix/heroUtils.ts
// Pure utility — no browser API imports so it is safe to import in tests.

export const HERO_COVER_SCORE_THRESHOLD = 60

export function pickHeroCandidate<T extends { coverScore?: number, [key: string]: unknown }>(
  trending: T[],
  forYou: T[],
): T | null {
  // 1. Find first trending item that meets the quality threshold.
  const fromTrending = trending.find(
    v => (v.coverScore ?? Number.POSITIVE_INFINITY) >= HERO_COVER_SCORE_THRESHOLD,
  )
  if (fromTrending)
    return fromTrending

  // 2. Check if all trending items have an explicit (but low) score.
  //    If yes, try forYou first — their scores are all below threshold.
  //    If some have NO score at all, prefer trending[0] (unknown = acceptable).
  const allTrendingHaveExplicitScore = trending.length > 0 && trending.every(v => v.coverScore !== undefined)
  if (allTrendingHaveExplicitScore) {
    // All below threshold — fall back to forYou
    return forYou[0] ?? trending[0] ?? null
  }

  // 3. Some trending items have no score — use first trending item.
  return trending[0] ?? forYou[0] ?? null
}

/**
 * Pick up to 3 hero candidates for the carousel.
 *
 * Rules (Decision #3):
 * 1. Scan Trending in order, collect items with coverScore >= threshold (up to 3).
 * 2. If fewer than 3, backfill from ForYou with the same threshold (by bvid/aid dedup).
 * 3. If a data source has NO coverScore fields at all, its items are only considered
 *    when the entire combined candidate list would otherwise be empty.
 * 4. 0 candidates → return []; 1 → static hero; 2-3 → carousel.
 */
export function pickHeroCandidates<T extends { coverScore?: number, bvid?: string, aid?: number, id?: number | string, [key: string]: unknown }>(
  trending: T[],
  forYou: T[],
  maxCandidates = 3,
): T[] {
  // Helper: extract unique key for dedup
  function videoKey(v: T): string {
    if (v.bvid)
      return `bvid:${v.bvid}`
    if (v.aid)
      return `aid:${v.aid}`
    if (v.id)
      return `id:${v.id}`
    return `idx:${Math.random()}` // fallback, won't dedup unknowns
  }

  const seen = new Set<string>()
  const candidates: T[] = []

  function addCandidate(item: T): boolean {
    if (candidates.length >= maxCandidates)
      return false
    const key = videoKey(item)
    if (seen.has(key))
      return false
    seen.add(key)
    candidates.push(item)
    return true
  }

  // Check if a source has any coverScore fields at all
  const trendingHasScores = trending.some(v => v.coverScore !== undefined)
  const forYouHasScores = forYou.some(v => v.coverScore !== undefined)

  // Phase 1: collect scored candidates from trending
  for (const item of trending) {
    if (candidates.length >= maxCandidates)
      break
    if (trendingHasScores) {
      // Only pick items meeting threshold if this source has scores
      if ((item.coverScore ?? 0) >= HERO_COVER_SCORE_THRESHOLD)
        addCandidate(item)
    }
    // If trending has no scores at all, skip for now (handled in phase 3)
  }

  // Phase 2: backfill from forYou with threshold
  if (candidates.length < maxCandidates) {
    for (const item of forYou) {
      if (candidates.length >= maxCandidates)
        break
      if (forYouHasScores) {
        if ((item.coverScore ?? 0) >= HERO_COVER_SCORE_THRESHOLD)
          addCandidate(item)
      }
      // If forYou has no scores at all, skip for now (handled in phase 3)
    }
  }

  // Phase 3: fallback — if still empty, use first available from either source
  // (happens when neither source has any coverScore fields)
  if (candidates.length === 0) {
    for (const item of [...trending, ...forYou]) {
      if (candidates.length >= maxCandidates)
        break
      addCandidate(item)
    }
  }

  return candidates
}
