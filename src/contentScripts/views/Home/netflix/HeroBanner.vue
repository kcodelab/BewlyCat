<!-- src/contentScripts/views/Home/netflix/HeroBanner.vue -->
<script setup lang="ts">
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
  video: HeroVideo | null
}

const props = defineProps<Props>()

function openVideo() {
  if (!props.video)
    return
  const { bvid, aid } = props.video
  if (bvid)
    window.open(`https://www.bilibili.com/video/${bvid}`, '_blank')
  else if (aid)
    window.open(`https://www.bilibili.com/video/av${aid}`, '_blank')
}

function openDetail() {
  openVideo()
}
</script>

<template>
  <div v-if="props.video" class="hero-banner">
    <!-- Background image -->
    <div
      class="hero-banner__bg"
      :style="{ backgroundImage: `url(${props.video.cover})` }"
    />

    <!-- Gradient overlay -->
    <div class="hero-banner__gradient" />

    <!-- Content -->
    <div class="hero-banner__content">
      <h1 class="hero-banner__title">
        {{ props.video.title }}
      </h1>
      <p v-if="props.video.desc" class="hero-banner__desc">
        {{ props.video.desc }}
      </p>
      <div class="hero-banner__actions">
        <button class="hero-banner__btn hero-banner__btn--play" @click="openVideo">
          ▶ 播放
        </button>
        <button class="hero-banner__btn hero-banner__btn--info" @click="openDetail">
          ℹ 更多信息
        </button>
      </div>
    </div>
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
</style>
