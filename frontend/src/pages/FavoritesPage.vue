<script setup>
import { onMounted } from "vue";
import EmptyState from "@/components/EmptyState.vue";
import { useFavoritesStore } from "@/stores/favorites";
import { formatDate } from "@/utils/format";

const favorites = useFavoritesStore();

onMounted(() => favorites.load(true));
</script>

<template>
  <section>
    <div class="section-head">
      <h2 class="section-title">Debates guardados</h2>
      <span class="text-muted" style="font-size: 0.85rem">{{ favorites.items.length }}</span>
    </div>

    <div v-if="favorites.items.length" class="surface list-card">
      <RouterLink
        v-for="favorite in favorites.items"
        :key="favorite.id"
        class="list-row"
        :to="{ name: 'debate', params: { id: favorite.debate.id } }"
      >
        <span class="material-symbols-rounded" style="color: #e74c3c">favorite</span>
        <span class="list-row-main">
          <span class="list-row-title" style="white-space: normal">{{ favorite.debate.title }}</span>
          <span class="list-row-sub">{{ formatDate(favorite.debate.dayDate) }}</span>
        </span>
        <span class="material-symbols-rounded" style="color: #b9c0ca">chevron_right</span>
      </RouterLink>
    </div>

    <EmptyState
      v-else
      icon="favorite"
      title="Sin favoritos"
      text="Toca el corazón de un debate para guardarlo y leerlo más tarde."
    />
  </section>
</template>
