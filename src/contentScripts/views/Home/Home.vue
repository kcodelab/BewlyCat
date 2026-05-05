<script setup lang="ts">
import { defineAsyncComponent, h } from 'vue'

import { useThemePack } from '~/composables/useThemePack'

import HomeClassic from './HomeClassic.vue'

const { isNetflixThemePack } = useThemePack()

// HomeClassic 是 99% 用户的默认布局，同步导入避免「Home.vue chunk → HomeClassic chunk」
// 二段加载罚时；HomeNetflix 仍然懒加载（小众且降低 default 用户的 bundle 体积）
const HomeNetflix = defineAsyncComponent({
  loader: () => import('./netflix/HomeNetflix.vue'),
  delay: 0,
  loadingComponent: () => h('div', { class: 'netflix-loading' }),
})
</script>

<template>
  <component :is="isNetflixThemePack ? HomeNetflix : HomeClassic" />
</template>
