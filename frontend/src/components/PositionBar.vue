<script setup>
import { computed } from "vue";

/**
 * Barra segmentada de posiciones, igual que en tdd-tu-debate-diario-pro:
 * verde a favor, rojo en contra, gris neutral.
 */
const props = defineProps({
  percentages: { type: Object, default: null },
  showLegend: { type: Boolean, default: true }
});

const data = computed(() => props.percentages || { favor: 0, contra: 0, neutral: 0, total: 0 });

const segment = (value, color) => ({
  width: `${Math.max(0, Number(value || 0))}%`,
  background: color
});
</script>

<template>
  <div>
    <div class="position-label">Posición de la comunidad</div>

    <div class="debate-segmented-bar" role="img" aria-label="Reparto de posiciones">
      <div class="debate-segment" :style="segment(data.favor, '#2ecc71')" />
      <div class="debate-segment" :style="segment(data.contra, '#e74c3c')" />
      <div class="debate-segment" :style="segment(data.neutral, '#bdc3c7')" />
    </div>

    <div v-if="showLegend" class="debate-legend">
      <span class="debate-legend-item">
        <span class="debate-legend-dot" style="background: #2ecc71" />
        A favor {{ data.favor }}%
      </span>
      <span class="debate-legend-item">
        <span class="debate-legend-dot" style="background: #e74c3c" />
        En contra {{ data.contra }}%
      </span>
      <span class="debate-legend-item">
        <span class="debate-legend-dot" style="background: #bdc3c7" />
        Neutral {{ data.neutral }}%
      </span>
    </div>
  </div>
</template>
