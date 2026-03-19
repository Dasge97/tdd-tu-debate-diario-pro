<script setup>
import { computed } from "vue";

const emit = defineEmits(["open"]);

const props = defineProps({
  debates: {
    type: Array,
    required: true
  }
});

const tickerDebates = computed(() => {
  if (!props.debates?.length) return [];
  // Duplicamos la lista para crear bucle visual continuo sin cortes.
  return [...props.debates, ...props.debates];
});
</script>

<template>
  <section class="q-pb-lg debate-carousel-wrap">
    <div class="row items-center justify-center q-px-md carousel-header">
      <h2 class="carousel-title q-my-none">Radar del día</h2>
    </div>

    <div class="news-ticker news-ticker-full">
      <div class="news-ticker-track">
        <button
          v-for="(debate, index) in tickerDebates"
          :key="`${debate.id}-${index}`"
          class="news-ticker-item"
          type="button"
          @click="emit('open', debate.id)"
        >
          <span class="news-title">{{ debate.title }}</span>
          <span class="news-meta">{{ debate.commentCount || 0 }} comentarios</span>
        </button>
      </div>
    </div>
  </section>
</template>
