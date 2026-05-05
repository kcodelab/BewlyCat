<!-- src/contentScripts/views/Home/netflix/HorizontalRow.vue -->
<script setup lang="ts">
import { ref } from 'vue'

import type { Video } from '~/components/VideoCard/types'
import VideoCard from '~/components/VideoCard/VideoCard.vue'

interface Props {
  title: string
  items: Video[]
  loading?: boolean
  error?: Error | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
})

const emit = defineEmits<{
  retry: []
}>()

const rowRef = ref<HTMLElement | null>(null)

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
  <section class="netflix-row">
    <h2 class="netflix-row__title">
      {{ title }}
    </h2>

    <div v-if="props.error" class="netflix-row__error">
      <span>加载失败，</span>
      <button class="netflix-row__retry-btn" @click="emit('retry')">
        点击重试
      </button>
    </div>

    <div v-else class="netflix-row__wrapper">
      <!-- Left arrow -->
      <button
        v-if="!props.loading && props.items.length > 0"
        class="netflix-row__arrow netflix-row__arrow--left"
        aria-label="Scroll left"
        @click="scrollLeft"
      >
        ‹
      </button>

      <!-- Scroll container -->
      <div ref="rowRef" class="netflix-row__scroll">
        <!-- Loading skeleton -->
        <template v-if="props.loading && props.items.length === 0">
          <div
            v-for="i in 6"
            :key="i"
            class="netflix-row__skeleton"
          />
        </template>

        <!-- Empty placeholder -->
        <div v-else-if="!props.loading && props.items.length === 0" class="netflix-row__empty">
          暂无内容
        </div>

        <!-- Cards -->
        <template v-else>
          <div
            v-for="item in props.items"
            :key="item.bvid ?? item.id"
            class="netflix-row__card-wrapper"
          >
            <VideoCard :video="item" />
          </div>
        </template>
      </div>

      <!-- Right arrow -->
      <button
        v-if="!props.loading && props.items.length > 0"
        class="netflix-row__arrow netflix-row__arrow--right"
        aria-label="Scroll right"
        @click="scrollRight"
      >
        ›
      </button>
    </div>
  </section>
</template>

<style scoped>
.netflix-row {
  margin-bottom: 2rem;
}

.netflix-row__title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #e5e5e5;
  margin-bottom: 0.5rem;
  padding: 0 2rem;
}

.netflix-row__wrapper {
  position: relative;
}

.netflix-row__scroll {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.5rem 2rem;
  scrollbar-width: none;
}

.netflix-row__scroll::-webkit-scrollbar {
  display: none;
}

.netflix-row__card-wrapper {
  flex: 0 0 220px;
  min-width: 0;
}

.netflix-row__skeleton {
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

.netflix-row__empty {
  color: #888;
  padding: 2rem;
}

.netflix-row__arrow {
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

.netflix-row__arrow:hover {
  background: rgba(20, 20, 20, 0.95);
}

.netflix-row__arrow--left {
  left: 0;
}

.netflix-row__arrow--right {
  right: 0;
}

.netflix-row__error {
  padding: 1rem 2rem;
  color: #aaa;
}

.netflix-row__retry-btn {
  background: none;
  border: none;
  color: #e50914;
  cursor: pointer;
  text-decoration: underline;
}
</style>
