<!-- src/contentScripts/views/Home/netflix/VideoCardHover.vue -->
<!-- Netflix-style hover overlay. Teleports to the HomeNetflix container. -->
<script setup lang="ts">
import type { Ref } from 'vue'
import { computed, inject } from 'vue'
import { useToast } from 'vue-toastification'

import type { Video } from '~/components/VideoCard/types'
import { useTopBarStore } from '~/stores/topBarStore'
import api from '~/utils/api'
import { calcCurrentTime } from '~/utils/dataFormatter'
import { getCSRF } from '~/utils/main'

interface Props {
  video: Video | null
  position: DOMRect | null
  visible: boolean
  isInWatchLater?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isInWatchLater: false,
})

const emit = defineEmits<{
  close: []
  toggleWatchLater: []
}>()

const toast = useToast()
const topBarStore = useTopBarStore()

// Inject the hover target element reference from HomeNetflix.vue
// Falls back to null if not in a HomeNetflix subtree (VideoCard on other pages).
const netflixHoverTarget = inject<Ref<HTMLElement | null>>('netflix-hover-target', ref(null))

// Teleport :to requires a string selector or Element, not null.
// :disabled handles the null case gracefully.
const hoverTarget = computed(() => netflixHoverTarget.value ?? null)
const teleportDisabled = computed(() => !hoverTarget.value)

// Position style — offset from viewport using getBoundingClientRect values
const positionStyle = computed(() => {
  if (!props.position || !props.visible)
    return { display: 'none' }

  const containerRect = hoverTarget.value?.getBoundingClientRect()
  const left = containerRect
    ? props.position.left - containerRect.left
    : props.position.left
  const top = containerRect
    ? props.position.top - containerRect.top
    : props.position.top

  // Center the hover card on the original card, scaled 1.3x
  const origW = props.position.width
  const origH = props.position.height
  const hoverW = origW * 1.3
  const hoverH = origH * 1.45

  return {
    position: 'absolute' as const,
    left: `${left - (hoverW - origW) / 2}px`,
    top: `${top - (hoverH - origH) / 2}px`,
    width: `${hoverW}px`,
    zIndex: 9999,
  }
})

const durationStr = computed(() => {
  if (!props.video)
    return ''
  if (props.video.duration)
    return calcCurrentTime(props.video.duration)
  return props.video.durationStr ?? ''
})

const coverUrl = computed(() => {
  if (!props.video?.cover)
    return ''
  const cover = props.video.cover.startsWith('//')
    ? `https:${props.video.cover}`
    : props.video.cover
  return `${cover}@672w_378h_1c_!web-home-common-cover`
})

const videoUrl = computed(() => {
  const v = props.video
  if (!v)
    return ''
  if (v.url)
    return v.url
  if (v.bvid)
    return `https://www.bilibili.com/video/${v.bvid}/`
  if (v.aid)
    return `https://www.bilibili.com/video/av${v.aid}/`
  return ''
})

const authorName = computed(() => {
  const v = props.video
  if (!v?.author)
    return ''
  if (Array.isArray(v.author))
    return v.author.map(a => a.name).filter(Boolean).join(' / ')
  return (v.author as any).name ?? ''
})

// +我的列表 = 加入稍后再看（决议 #5: 复用现有 watchLater API）
async function handleWatchLater() {
  if (!props.video)
    return
  emit('toggleWatchLater')

  if (!props.isInWatchLater) {
    const params: { bvid?: string, aid?: number, csrf: string } = { csrf: getCSRF() }
    if (props.video.bvid)
      params.bvid = props.video.bvid
    else
      params.aid = props.video.id

    api.watchlater.saveToWatchLater(params).then((res) => {
      if (res.code === 0) {
        setTimeout(() => topBarStore.getAllWatchLaterList(), 1000)
      }
      else {
        toast.error(res.message)
      }
    })
  }
  else {
    api.watchlater.removeFromWatchLater({
      aid: props.video.id,
      csrf: getCSRF(),
    }).then((res) => {
      if (res.code === 0) {
        setTimeout(() => topBarStore.getAllWatchLaterList(), 1000)
      }
      else {
        toast.error(res.message)
      }
    })
  }
}
</script>

<template>
  <Teleport
    :to="hoverTarget"
    :disabled="teleportDisabled"
  >
    <Transition name="netflix-hover-fade">
      <div
        v-if="props.visible && props.video && props.position"
        class="netflix-card-hover"
        :style="positionStyle"
        @mouseenter="$emit('close')"
      >
        <!-- Cover Image -->
        <div class="netflix-card-hover__cover">
          <img
            v-if="coverUrl"
            :src="coverUrl"
            :alt="props.video.title"
            class="netflix-card-hover__img"
          >
          <!-- Play Button Overlay -->
          <a
            v-if="videoUrl"
            :href="videoUrl"
            class="netflix-card-hover__play-btn"
            target="_blank"
            rel="noopener"
            @click.stop=""
          >
            <div i-mingcute:play-circle-fill class="netflix-card-hover__play-icon" />
          </a>
        </div>

        <!-- Action Buttons -->
        <div class="netflix-card-hover__actions">
          <!-- +我的列表 = 加入稍后再看 (决议 #5) -->
          <button
            class="netflix-card-hover__btn"
            :class="{ 'netflix-card-hover__btn--active': props.isInWatchLater }"
            :aria-label="props.isInWatchLater ? $t('common.added') : $t('common.save_to_watch_later')"
            :title="props.isInWatchLater ? $t('common.added') : $t('common.save_to_watch_later')"
            @click.stop="handleWatchLater"
          >
            <div
              :class="props.isInWatchLater ? 'i-mingcute:check-line' : 'i-mingcute:carplay-line'"
              class="netflix-card-hover__btn-icon"
            />
          </button>
        </div>

        <!-- Metadata -->
        <div class="netflix-card-hover__meta">
          <p class="netflix-card-hover__title">
            {{ props.video.title }}
          </p>
          <div class="netflix-card-hover__sub">
            <span v-if="authorName" class="netflix-card-hover__author">{{ authorName }}</span>
            <span v-if="durationStr" class="netflix-card-hover__duration">{{ durationStr }}</span>
          </div>
          <p v-if="props.video.capsuleText" class="netflix-card-hover__desc">
            {{ props.video.capsuleText }}
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.netflix-card-hover {
  border-radius: 6px;
  overflow: hidden;
  background: var(--bew-bg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
  pointer-events: auto;
  /* Prevent clicks from propagating to card below */
  isolation: isolate;
}

.netflix-card-hover__cover {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
}

.netflix-card-hover__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.netflix-card-hover__play-btn {
  position: absolute;
  bottom: 0.5rem;
  left: 0.5rem;
  color: white;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  transition: background 0.2s;
}

.netflix-card-hover__play-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.netflix-card-hover__play-icon {
  font-size: 1.75rem;
}

.netflix-card-hover__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem 0.25rem;
}

.netflix-card-hover__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.7);
  background: transparent;
  color: white;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.netflix-card-hover__btn:hover {
  border-color: white;
  background: rgba(255, 255, 255, 0.1);
}

.netflix-card-hover__btn--active {
  border-color: white;
  background: rgba(255, 255, 255, 0.15);
}

.netflix-card-hover__btn-icon {
  font-size: 1rem;
}

.netflix-card-hover__meta {
  padding: 0 0.75rem 0.75rem;
}

.netflix-card-hover__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 0.25rem;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.netflix-card-hover__sub {
  display: flex;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0.35rem;
}

.netflix-card-hover__author {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}

.netflix-card-hover__duration {
  white-space: nowrap;
}

.netflix-card-hover__desc {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.55);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

/* Fade transition */
.netflix-hover-fade-enter-active,
.netflix-hover-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.netflix-hover-fade-enter-from,
.netflix-hover-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
