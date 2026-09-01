<script setup>
import { computed } from "vue";

/** Circulo que aparece al tirar de la lista hacia abajo para recargarla. */
const props = defineProps({
  avance: { type: Number, default: 0 },
  recargando: { type: Boolean, default: false }
});

const visible = computed(() => props.avance > 0 || props.recargando);

/* El icono gira segun lo que se haya tirado, hasta completar una vuelta. */
const giro = computed(() => Math.min(360, (props.avance / 70) * 360));
</script>

<template>
  <div
    v-if="visible"
    class="recarga"
    :style="{ transform: `translate(-50%, ${Math.max(0, avance - 40)}px)` }"
  >
    <span
      class="material-symbols-rounded"
      :class="{ 'recarga-girando': recargando }"
      :style="recargando ? '' : `transform: rotate(${giro}deg)`"
    >
      refresh
    </span>
  </div>
</template>

<style scoped>
.recarga {
  position: fixed;
  top: calc(var(--tdd-header-h) + var(--safe-top) + 4px);
  left: 50%;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--tdd-surface);
  border: 1px solid var(--tdd-line);
  box-shadow: 0 6px 18px rgba(20, 23, 31, 0.14);
  color: var(--tdd-primary);
  pointer-events: none;
}

.recarga .material-symbols-rounded {
  font-size: 21px;
}

.recarga-girando {
  animation: recarga-vuelta 0.8s linear infinite;
}

@keyframes recarga-vuelta {
  to {
    transform: rotate(360deg);
  }
}
</style>
