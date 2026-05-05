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
