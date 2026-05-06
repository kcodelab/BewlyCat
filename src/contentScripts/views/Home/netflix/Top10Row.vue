<!-- src/contentScripts/views/Home/netflix/Top10Row.vue -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Video } from '~/components/VideoCard/types'
import VideoCard from '~/components/VideoCard/VideoCard.vue'
import { useRankingData } from '~/contentScripts/views/Home/composables/useRankingData'

const { t } = useI18n()

// Use the default ranking type (all categories)
const defaultRankingType = { id: 1, name: '全站' }

const { items, loading, error, loadVideos } = useRankingData()

// Take first 10 items
const top10Items = computed<Video[]>(() => {
  return items.slice(0, 10).map(item => item.displayData).filter((v): v is Video => !!v)
})

// 懒加载：进入视口前 300px 才发首次请求
const sectionRef = ref<HTMLElement | null>(null)
let activated = false
let observer: IntersectionObserver | null = null
onMounted(() => {
  if (!sectionRef.value || typeof IntersectionObserver === 'undefined') {
    if (!activated && items.length === 0) {
      activated = true
      loadVideos(defaultRankingType)
    }
    return
  }
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting && !activated) {
      activated = true
      if (items.length === 0)
        loadVideos(defaultRankingType)
      observer?.disconnect()
      observer = null
    }
  }, { rootMargin: '300px 0px' })
  observer.observe(sectionRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

function onRetry() {
  loadVideos(defaultRankingType)
}

// SVG path data for digits 0-9 (stroked, no fill — Netflix style)
// Viewbox 0 0 100 160 to give tall proportions
const DIGIT_PATHS: Record<string, string> = {
  '0': 'M50 10 C20 10 10 35 10 80 C10 125 20 150 50 150 C80 150 90 125 90 80 C90 35 80 10 50 10Z',
  '1': 'M30 35 L55 10 L55 150 M30 150 L80 150',
  '2': 'M15 45 C15 15 85 15 85 55 C85 85 15 110 15 150 L85 150',
  '3': 'M15 15 L80 15 L45 78 C75 78 90 100 90 120 C90 145 70 155 50 155 C30 155 15 145 12 130',
  '4': 'M70 150 L70 10 L10 105 L90 105',
  '5': 'M80 10 L20 10 L15 75 C25 65 40 60 55 62 C80 66 90 90 85 120 C80 148 60 158 40 155 C22 152 10 140 8 125',
  '6': 'M75 20 C60 8 20 15 12 70 C8 110 20 155 52 157 C80 157 95 138 93 112 C91 86 72 72 50 74 C28 76 12 95 15 115',
  '7': 'M10 10 L90 10 L40 150',
  '8': 'M50 10 C25 10 12 28 12 52 C12 70 22 84 50 92 C78 100 90 114 90 135 C90 148 75 158 50 158 C25 158 10 148 10 135 C10 114 22 100 50 92 C78 84 88 70 88 52 C88 28 75 10 50 10Z',
  '9': 'M25 140 C40 153 80 147 88 90 C92 50 80 5 48 3 C20 1 5 20 7 46 C9 72 28 86 50 86 C72 86 91 66 88 46',
}

// Map rank 1-10 to digit characters for SVG rendering
function getRankDigits(rank: number): string[] {
  return String(rank).split('')
}

function getPath(digit: string): string {
  return DIGIT_PATHS[digit] ?? DIGIT_PATHS['0']
}
</script>

<template>
  <section ref="sectionRef" class="top10-row">
    <h2 class="top10-row__title">
      <span class="top10-row__title-bar" aria-hidden="true" />
      {{ t('home.top10_today') }}
    </h2>

    <div v-if="error" class="top10-row__error">
      <span>加载失败，</span>
      <button class="top10-row__retry-btn" @click="onRetry">
        点击重试
      </button>
    </div>

    <div v-else class="top10-row__wrapper">
      <!-- Loading skeleton -->
      <template v-if="loading && top10Items.length === 0">
        <div
          v-for="i in 6"
          :key="i"
          class="top10-row__skeleton"
        />
      </template>

      <!-- Empty placeholder -->
      <div v-else-if="!loading && top10Items.length === 0" class="top10-row__empty">
        暂无内容
      </div>

      <!-- Cards with SVG rank numbers -->
      <template v-else>
        <div
          v-for="(item, idx) in top10Items"
          :key="item.bvid ?? item.id"
          class="top10-row__item"
        >
          <!-- SVG oversized rank number -->
          <div class="top10-row__rank" aria-hidden="true">
            <svg
              v-for="digit in getRankDigits(idx + 1)"
              :key="digit + idx"
              class="top10-row__rank-svg"
              viewBox="0 0 100 160"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
            >
              <path
                :d="getPath(digit)"
                stroke="rgba(255,255,255,0.85)"
                stroke-width="8"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
            </svg>
          </div>

          <!-- Video card sits on top of number via z-index -->
          <div class="top10-row__card">
            <VideoCard :video="item" variant="netflix-row" />
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.top10-row {
  margin-bottom: 2rem;
}

.top10-row__title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #e5e5e5;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
}

.top10-row__title-bar {
  display: inline-block;
  width: 4px;
  height: 1em;
  background: var(--bew-theme-color, #e50914);
  border-radius: 2px;
  margin-right: 8px;
  flex-shrink: 0;
  vertical-align: middle;
}

.top10-row__error {
  padding: 1rem 0;
  color: #aaa;
}

.top10-row__retry-btn {
  background: none;
  border: none;
  color: #e50914;
  cursor: pointer;
  text-decoration: underline;
}

.top10-row__wrapper {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.5rem 0 1rem;
  scrollbar-width: none;
}

.top10-row__wrapper::-webkit-scrollbar {
  display: none;
}

.top10-row__skeleton {
  flex: 0 0 220px;
  height: 140px;
  background: #333;
  border-radius: 4px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.top10-row__empty {
  color: #888;
  padding: 2rem;
}

/* ── Card + rank layout ─────────────────────────── */
.top10-row__item {
  /* Grid: rank number overlaps left side of card */
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  /* Leave room on the left for the number */
  padding-left: clamp(60px, 9vw, 120px);
  flex: 0 0 auto;
}

.top10-row__rank {
  position: absolute;
  left: 0;
  bottom: 0;
  /* Number is tall; bottom-align with card bottom */
  display: flex;
  align-items: flex-end;
  /* z-index BELOW card image so card half-covers the number */
  z-index: 0;
  height: 100%;
  pointer-events: none;
}

.top10-row__rank-svg {
  /* Each digit SVG */
  height: clamp(120px, 18vw, 240px);
  width: auto;
  /* Negative left offset so digit starts behind the card edge */
  margin-left: -4px;
  /* Allow slight vertical overflow */
  overflow: visible;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8));
}

.top10-row__card {
  /* Sits ABOVE rank number */
  position: relative;
  z-index: 1;
  width: 220px;
}
</style>
