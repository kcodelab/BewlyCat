<script setup lang="ts">
const channels = [
  { labelKey: 'topbar.logo_dropdown.animations', url: 'https://www.bilibili.com/c/douga/' },
  { labelKey: 'topbar.logo_dropdown.anime', url: 'https://www.bilibili.com/anime/' },
  { labelKey: 'topbar.logo_dropdown.chinese_anime', url: 'https://www.bilibili.com/guochuang/' },
  { labelKey: 'topbar.logo_dropdown.music', url: 'https://www.bilibili.com/c/music/' },
  { labelKey: 'topbar.logo_dropdown.dance', url: 'https://www.bilibili.com/c/dance/' },
  { labelKey: 'topbar.logo_dropdown.gaming', url: 'https://www.bilibili.com/c/game/' },
  { labelKey: 'topbar.logo_dropdown.knowledge', url: 'https://www.bilibili.com/c/knowledge/' },
  { labelKey: 'topbar.logo_dropdown.technology', url: 'https://www.bilibili.com/c/tech/' },
  { labelKey: 'topbar.logo_dropdown.sports', url: 'https://www.bilibili.com/c/sports/' },
  { labelKey: 'topbar.logo_dropdown.cars', url: 'https://www.bilibili.com/c/auto/' },
  { labelKey: 'topbar.logo_dropdown.life_experience', url: 'https://www.bilibili.com/c/life_experience/' },
  { labelKey: 'topbar.logo_dropdown.foods', url: 'https://www.bilibili.com/c/food/' },
  { labelKey: 'topbar.logo_dropdown.animals', url: 'https://www.bilibili.com/c/animal/' },
  { labelKey: 'topbar.logo_dropdown.kichiku', url: 'https://www.bilibili.com/c/kichiku/' },
  { labelKey: 'topbar.logo_dropdown.fashion', url: 'https://www.bilibili.com/c/fashion/' },
  { labelKey: 'topbar.logo_dropdown.showbiz', url: 'https://www.bilibili.com/c/ent/' },
  { labelKey: 'topbar.logo_dropdown.cinephile', url: 'https://www.bilibili.com/c/cinephile/' },
  { labelKey: 'topbar.logo_dropdown.documentary_films', url: 'https://www.bilibili.com/documentary/' },
  { labelKey: 'topbar.logo_dropdown.movies', url: 'https://www.bilibili.com/movie/' },
  { labelKey: 'topbar.logo_dropdown.tv_shows', url: 'https://www.bilibili.com/tv/' },
  { labelKey: 'topbar.logo_dropdown.variety_shows', url: 'https://www.bilibili.com/variety/' },
] as const

function openChannel(url: string) {
  window.location.href = url
}
</script>

<template>
  <section class="channels-grid">
    <h2 class="channels-grid__title">
      <span class="channels-grid__title-bar" aria-hidden="true" />
      {{ $t('home.channels') }}
    </h2>
    <div class="channels-grid__list">
      <button
        v-for="ch in channels"
        :key="ch.url"
        class="channels-grid__tile"
        type="button"
        @click="openChannel(ch.url)"
      >
        {{ $t(ch.labelKey) }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.channels-grid {
  margin-bottom: 1rem;
}

.channels-grid__title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #e5e5e5;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
}

.channels-grid__title-bar {
  display: inline-block;
  width: 4px;
  height: 1em;
  background: var(--bew-theme-color, #e50914);
  border-radius: 2px;
  margin-right: 8px;
  flex-shrink: 0;
}

.channels-grid__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.6rem;
}

.channels-grid__tile {
  position: relative;
  padding: 1.1rem 1.25rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.04);
  color: #e5e5e5;
  font-size: 0.95rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.18s,
    border-color 0.18s,
    transform 0.12s;
  user-select: none;
  overflow: hidden;
}

.channels-grid__tile::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 0%, transparent 60%, rgba(229, 9, 20, 0.08) 100%);
  opacity: 0;
  transition: opacity 0.18s;
  pointer-events: none;
}

.channels-grid__tile:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(229, 9, 20, 0.5);
  transform: translateY(-1px);
}

.channels-grid__tile:hover::before {
  opacity: 1;
}

.channels-grid__tile:active {
  transform: translateY(0);
}
</style>
