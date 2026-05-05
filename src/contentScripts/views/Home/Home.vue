<script setup lang="ts">
import { defineAsyncComponent, h } from 'vue'

import { useThemePack } from '~/composables/useThemePack'

const { isNetflixThemePack } = useThemePack()

const HomeClassic = defineAsyncComponent({
  loader: () => import('./HomeClassic.vue'),
  delay: 0,
})

const HomeNetflix = defineAsyncComponent({
  loader: () => import('./netflix/HomeNetflix.vue'),
  delay: 0,
  loadingComponent: () => h('div', { class: 'netflix-loading' }),
})
</script>

<template>
  <component :is="isNetflixThemePack ? HomeNetflix : HomeClassic" />
</template>
