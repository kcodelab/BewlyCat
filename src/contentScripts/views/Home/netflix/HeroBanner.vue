<!-- src/contentScripts/views/Home/netflix/HeroBanner.vue -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { removeHttpFromUrl } from '~/utils/main'

interface HeroVideo {
  id?: number
  title?: string
  desc?: string
  cover?: string
  bvid?: string
  aid?: number
  [key: string]: unknown
}

interface Props {
  /** Array of 0-3 hero candidates. */
  videos: HeroVideo[]
}

const props = defineProps<Props>()

// ── Derived state ──────────────────────────────────────────────────
const hasItems = computed(() => props.videos.length > 0)
const isCarousel = computed(() => props.videos.length >= 2)
const current = ref(0)

// Clamp current index when videos change
const currentVideo = computed(() => {
  if (props.videos.length === 0)
    return null
  return props.videos[Math.min(current.value, props.videos.length - 1)]
})

// ── Auto-rotate ────────────────────────────────────────────────────
let timer: ReturnType<typeof setInterval> | null = null
const isPaused = ref(false)

function startTimer() {
  if (!isCarousel.value)
    return
  stopTimer()
  timer = setInterval(() => {
    if (!isPaused.value)
      goNext()
  }, 8000)
}

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

function goTo(index: number) {
  current.value = index
  startTimer() // reset 8s on explicit navigation
}

function goNext() {
  current.value = (current.value + 1) % props.videos.length
}

function onMouseEnter() {
  isPaused.value = true
}

function onMouseLeave() {
  isPaused.value = false
}

onMounted(() => {
  if (isCarousel.value)
    startTimer()
})

onBeforeUnmount(() => {
  stopTimer()
})

// ── Navigation ─────────────────────────────────────────────────────
function openVideo(video: HeroVideo | null) {
  if (!video)
    return
  const { bvid, aid } = video
  if (bvid)
    window.open(`https://www.bilibili.com/video/${bvid}`, '_blank')
  else if (aid)
    window.open(`https://www.bilibili.com/video/av${aid}`, '_blank')
}
</script>

<template>
  <div
    v-if="hasItems"
    class="hero-banner"
  >
    <!-- Slides (crossfade via v-show) -->
    <template v-for="(video, idx) in props.videos" :key="video.bvid ?? video.aid ?? idx">
      <Transition name="hero-fade">
        <div v-show="idx === current" class="hero-banner__slide">
          <!-- Background image (strip http: to avoid mixed-content block on HTTPS) -->
          <div
            class="hero-banner__bg"
            :style="{ backgroundImage: `url('${removeHttpFromUrl(video.cover ?? '')}')` }"
          />
          <!-- Gradient overlay -->
          <div class="hero-banner__gradient" />
        </div>
      </Transition>
    </template>

    <!-- Content (always uses currentVideo for smooth text transition) -->
    <Transition name="hero-content-fade" mode="out-in">
      <div
        v-if="currentVideo"
        :key="currentVideo.bvid ?? currentVideo.aid ?? current"
        class="hero-banner__content"
        @mouseenter="onMouseEnter"
        @mouseleave="onMouseLeave"
      >
        <h1 class="hero-banner__title">
          {{ currentVideo.title }}
        </h1>
        <p v-if="currentVideo.desc" class="hero-banner__desc">
          {{ currentVideo.desc }}
        </p>
        <div class="hero-banner__actions">
          <button class="hero-banner__btn hero-banner__btn--play" @click="openVideo(currentVideo)">
            <div i-mingcute:play-fill class="hero-banner__btn-icon" />
            <span>播放</span>
          </button>
          <button class="hero-banner__btn hero-banner__btn--info" @click="openVideo(currentVideo)">
            <div i-mingcute:information-line class="hero-banner__btn-icon" />
            <span>更多信息</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Carousel controls (only shown for 2-3 items) -->
    <template v-if="isCarousel">
      <!-- Pagination dots -->
      <div class="hero-banner__dots">
        <button
          v-for="(_, idx) in props.videos"
          :key="idx"
          class="hero-banner__dot"
          :class="{ 'hero-banner__dot--active': idx === current }"
          :aria-label="`切换到第 ${idx + 1} 张`"
          @click="goTo(idx)"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.hero-banner {
  /* full-bleed: 把 Hero 拉伸到视口左右边，跳出 .netflix-home 的 2rem padding */
  position: relative;
  width: 100vw;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
  /* 让 Hero 顶起到屏幕顶部，TopBar 半透明叠在上面（与 App.vue 的
     padding-top: top-bar-height + 10px 抵消） */
  margin-top: calc(-1 * (var(--bew-top-bar-height, 60px) + 10px));
  /* 高度收敛：以宽屏 16:9 为基准，但限制最大 60vh、最小 280px，
     避免超大屏幕下 Hero 占满整个视口造成压迫 */
  height: 42vw;
  max-height: 60vh;
  min-height: 280px;
  overflow: hidden;
  background: var(--bew-bg);
  margin-bottom: 1.5rem;
}

/* ── Slides ─────────────────────────────────────── */
.hero-banner__slide {
  position: absolute;
  inset: 0;
}

.hero-banner__bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;
}

.hero-banner__gradient {
  position: absolute;
  inset: 0;
  /* 顶部一道淡黑做 TopBar 让位（让透明顶栏文字在亮色封面上仍可读），
     底部柔和长渐变融入页面背景，避免硬边 */
  background:
    linear-gradient(to bottom, rgba(20, 20, 20, 0.55) 0%, rgba(20, 20, 20, 0) 18%),
    linear-gradient(
      to bottom,
      transparent 0%,
      transparent 30%,
      rgba(20, 20, 20, 0.35) 55%,
      rgba(20, 20, 20, 0.7) 80%,
      var(--bew-bg) 100%
    );
}

/* 底部磨砂渐变过度：在 Hero 容器最下方再叠一道极柔的边缘虚化，
   让 Hero 与下方 row 之间的过渡看起来不那么硬 */
.hero-banner::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 60px;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, var(--bew-bg));
  z-index: 1;
}

/* ── Content ─────────────────────────────────────── */
.hero-banner__content {
  position: absolute;
  bottom: 15%;
  left: 4%;
  max-width: 40%;
  z-index: 2;
}

.hero-banner__title {
  font-size: clamp(1.5rem, 3.5vw, 3rem);
  font-weight: 700;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  margin-bottom: 0.75rem;
  line-height: 1.2;
}

.hero-banner__desc {
  font-size: clamp(0.75rem, 1.3vw, 1rem);
  color: #e5e5e5;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.6);
  margin-bottom: 1.25rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hero-banner__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.hero-banner__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.6rem 1.6rem;
  border: none;
  border-radius: 6px;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition:
    background-color 0.2s,
    opacity 0.2s,
    transform 0.1s;
  user-select: none;
}

.hero-banner__btn:hover {
  opacity: 0.85;
}

.hero-banner__btn:active {
  transform: scale(0.98);
}

.hero-banner__btn-icon {
  width: 1.35em;
  height: 1.35em;
  flex-shrink: 0;
}

.hero-banner__btn--play {
  background: #fff;
  color: #141414;
}

.hero-banner__btn--info {
  background: rgba(109, 109, 110, 0.7);
  color: #fff;
}

.hero-banner__btn--info:hover {
  background: rgba(109, 109, 110, 0.85);
  opacity: 1;
}

/* ── Pagination dots ─────────────────────────────── */
.hero-banner__dots {
  position: absolute;
  bottom: 1rem;
  right: 4%;
  display: flex;
  gap: 0.4rem;
  z-index: 3;
}

.hero-banner__dot {
  width: 10px;
  height: 3px;
  border-radius: 2px;
  border: none;
  background: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition:
    background 0.25s,
    width 0.25s;
  padding: 0;
}

.hero-banner__dot--active {
  background: #fff;
  width: 20px;
}

/* ── Transitions ─────────────────────────────────── */
.hero-fade-enter-active,
.hero-fade-leave-active {
  transition: opacity 0.8s ease;
}

.hero-fade-enter-from,
.hero-fade-leave-to {
  opacity: 0;
}

.hero-content-fade-enter-active,
.hero-content-fade-leave-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}

.hero-content-fade-enter-from,
.hero-content-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
