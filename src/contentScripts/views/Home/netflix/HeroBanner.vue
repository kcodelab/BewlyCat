<!-- src/contentScripts/views/Home/netflix/HeroBanner.vue -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

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
const isMuted = ref(true)

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

function toggleMute() {
  isMuted.value = !isMuted.value
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
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <!-- Slides (crossfade via v-show) -->
    <template v-for="(video, idx) in props.videos" :key="video.bvid ?? video.aid ?? idx">
      <Transition name="hero-fade">
        <div v-show="idx === current" class="hero-banner__slide">
          <!-- Background image -->
          <div
            class="hero-banner__bg"
            :style="{ backgroundImage: `url(${video.cover})` }"
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
      >
        <h1 class="hero-banner__title">
          {{ currentVideo.title }}
        </h1>
        <p v-if="currentVideo.desc" class="hero-banner__desc">
          {{ currentVideo.desc }}
        </p>
        <div class="hero-banner__actions">
          <button class="hero-banner__btn hero-banner__btn--play" @click="openVideo(currentVideo)">
            ▶ 播放
          </button>
          <button class="hero-banner__btn hero-banner__btn--info" @click="openVideo(currentVideo)">
            ℹ 更多信息
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

      <!-- Mute / Unmute button (UI placeholder — no actual audio in this version) -->
      <button
        class="hero-banner__mute-btn"
        :aria-label="isMuted ? '取消静音' : '静音'"
        :title="isMuted ? '取消静音' : '静音'"
        @click="toggleMute"
      >
        <span v-if="isMuted" class="hero-banner__mute-icon">🔇</span>
        <span v-else class="hero-banner__mute-icon">🔊</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.hero-banner {
  position: relative;
  width: 100%;
  height: 56.25vw;
  max-height: 80vh;
  min-height: 300px;
  overflow: hidden;
  background: #141414;
  margin-bottom: 2.5rem;
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
  background: linear-gradient(to bottom, transparent 40%, rgba(20, 20, 20, 0.6) 70%, rgba(20, 20, 20, 0.95) 100%);
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
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.hero-banner__btn:hover {
  opacity: 0.85;
}

.hero-banner__btn--play {
  background: #fff;
  color: #141414;
}

.hero-banner__btn--info {
  background: rgba(109, 109, 110, 0.7);
  color: #fff;
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

/* ── Mute button ─────────────────────────────────── */
.hero-banner__mute-btn {
  position: absolute;
  bottom: 4rem;
  right: 4%;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.7);
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.hero-banner__mute-btn:hover {
  border-color: #fff;
  background: rgba(0, 0, 0, 0.65);
}

.hero-banner__mute-icon {
  font-size: 1rem;
  line-height: 1;
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
