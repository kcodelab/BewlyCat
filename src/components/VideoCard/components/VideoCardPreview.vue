<script lang="ts" setup>
/**
 * VideoCardPreview — named wrapper for the hover video preview block.
 * Having this as a named component lets tests locate it via
 * `findComponent({ name: 'VideoCardPreview' })`.
 *
 * The actual video element is exposed via `defineExpose` so the parent
 * (VideoCardCover) can attach HLS/FLV players to it.
 */

defineOptions({ name: 'VideoCardPreview' })

const props = defineProps<{
  previewVideoUrl: string
  isHover: boolean
  showVideoControls: boolean
  isLoadingStream: boolean
}>()

defineEmits<{
  mousemove: [e: MouseEvent]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)

defineExpose({ videoRef })
</script>

<template>
  <Transition name="fade">
    <div
      v-if="props.previewVideoUrl && props.isHover"
      pos="absolute top-0 left-0" w-full aspect-video rounded="$bew-radius" bg-black
      @mousemove="$emit('mousemove', $event)"
    >
      <video
        ref="videoRef"
        autoplay muted
        :controls="props.showVideoControls"
        :style="{ pointerEvents: props.showVideoControls ? 'auto' : 'none' }"
        w-full h-full
      />

      <!-- Loading indicator -->
      <Transition name="fade">
        <div
          v-if="props.isLoadingStream"
          pos="absolute top-0 left-0"
          w-full h-full
          flex="~ items-center justify-center"
          bg="black/50"
          pointer-events-none
        >
          <div class="loading-spinner" />
        </div>
      </Transition>
    </div>
  </Transition>
</template>
