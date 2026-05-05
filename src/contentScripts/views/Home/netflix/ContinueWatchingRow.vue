<!-- src/contentScripts/views/Home/netflix/ContinueWatchingRow.vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Video } from '~/components/VideoCard/types'
import VideoCard from '~/components/VideoCard/VideoCard.vue'
import { useHistoryData } from '~/contentScripts/views/Home/composables/useHistoryData'

const { t } = useI18n()

const { items, loading, error, load } = useHistoryData()

interface EnrichedItem {
  video: Video
  progressPercent: number
}

// Map history items to VideoCard-compatible Video objects + progress
const enrichedItems = computed<EnrichedItem[]>(() => {
  return items.value.map((item) => {
    const progress = item.progress ?? 0
    const duration = item.duration ?? 0
    const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0

    const video: Video = {
      id: item.history?.oid ?? 0,
      title: item.title ?? '',
      cover: item.cover ?? '',
      bvid: item.history?.bvid ?? '',
      duration: item.duration,
      author: item.author_name
        ? {
            name: item.author_name,
            authorFace: item.author_face ?? '',
            mid: item.author_mid ?? 0,
          }
        : undefined,
      threePointV2: [],
    }

    return { video, progressPercent }
  })
})

const rowRef = ref<HTMLElement | null>(null)

onMounted(async () => {
  if (items.value.length === 0)
    await load()
})

function onRetry() {
  load()
}

function scrollLeft() {
  if (rowRef.value)
    rowRef.value.scrollBy({ left: -rowRef.value.clientWidth, behavior: 'smooth' })
}

function scrollRight() {
  if (rowRef.value)
    rowRef.value.scrollBy({ left: rowRef.value.clientWidth, behavior: 'smooth' })
}
</script>

<template>
  <section class="continue-row">
    <h2 class="continue-row__title">
      <span class="continue-row__title-bar" aria-hidden="true" />
      {{ t('home.continue_watching') }}
    </h2>

    <div v-if="error" class="continue-row__error">
      <span>加载失败，</span>
      <button class="continue-row__retry-btn" @click="onRetry">
        点击重试
      </button>
    </div>

    <div v-else class="continue-row__wrapper">
      <!-- Left arrow -->
      <button
        v-if="!loading && enrichedItems.length > 0"
        class="continue-row__arrow continue-row__arrow--left"
        aria-label="Scroll left"
        @click="scrollLeft"
      >
        ‹
      </button>

      <!-- Scroll container -->
      <div ref="rowRef" class="continue-row__scroll">
        <!-- Loading skeleton -->
        <template v-if="loading && enrichedItems.length === 0">
          <div
            v-for="i in 6"
            :key="i"
            class="continue-row__skeleton"
          />
        </template>

        <!-- Empty placeholder -->
        <div v-else-if="!loading && enrichedItems.length === 0" class="continue-row__empty">
          暂无内容
        </div>

        <!-- Cards with progress bars wrapped in a div (no VideoCard.vue changes) -->
        <template v-else>
          <div
            v-for="{ video, progressPercent } in enrichedItems"
            :key="video.bvid ?? video.id"
            class="continue-row__card-wrapper"
          >
            <VideoCard :video="video" variant="netflix-row" />
            <!-- Progress bar overlay — positioned at the bottom of this wrapper -->
            <div
              v-if="progressPercent > 0"
              class="continue-row__progress-track"
              aria-hidden="true"
            >
              <div
                class="continue-row__progress-fill"
                :style="{ width: `${progressPercent}%` }"
              />
            </div>
          </div>
        </template>
      </div>

      <!-- Right arrow -->
      <button
        v-if="!loading && enrichedItems.length > 0"
        class="continue-row__arrow continue-row__arrow--right"
        aria-label="Scroll right"
        @click="scrollRight"
      >
        ›
      </button>
    </div>
  </section>
</template>

<style scoped>
.continue-row {
  margin-bottom: 2rem;
}

.continue-row__title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #e5e5e5;
  margin-bottom: 0.5rem;
  padding: 0 2rem;
  display: flex;
  align-items: center;
}

.continue-row__title-bar {
  display: inline-block;
  width: 4px;
  height: 1em;
  background: var(--bew-theme-color, #e50914);
  border-radius: 2px;
  margin-right: 8px;
  flex-shrink: 0;
  vertical-align: middle;
}

.continue-row__error {
  padding: 1rem 2rem;
  color: #aaa;
}

.continue-row__retry-btn {
  background: none;
  border: none;
  color: #e50914;
  cursor: pointer;
  text-decoration: underline;
}

.continue-row__wrapper {
  position: relative;
}

.continue-row__scroll {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.5rem 2rem;
  scrollbar-width: none;
}

.continue-row__scroll::-webkit-scrollbar {
  display: none;
}

.continue-row__skeleton {
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

.continue-row__empty {
  color: #888;
  padding: 2rem;
}

/* ── Card wrapper with progress bar ─────────────── */
.continue-row__card-wrapper {
  flex: 0 0 220px;
  min-width: 0;
  position: relative;
}

.continue-row__progress-track {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.15);
  z-index: 2;
  border-radius: 0 0 4px 4px;
  overflow: hidden;
}

.continue-row__progress-fill {
  height: 100%;
  background: var(--bew-theme-color, #e50914);
  border-radius: 0 0 4px 4px;
  transition: width 0.3s ease;
}

/* ── Arrows ─────────────────────────────────────── */
.continue-row__arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  background: rgba(20, 20, 20, 0.7);
  border: none;
  color: #fff;
  font-size: 2rem;
  line-height: 1;
  width: 2rem;
  height: 4rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.continue-row__arrow:hover {
  background: rgba(20, 20, 20, 0.95);
}

.continue-row__arrow--left {
  left: 0;
}

.continue-row__arrow--right {
  right: 0;
}
</style>
