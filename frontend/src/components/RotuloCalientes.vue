<script setup>
import { computed, onMounted } from "vue";
import { useDebatesStore } from "@/stores/debates";

/**
 * Linea de texto que pasa sola, como el rotulo de titulares de un informativo.
 *
 * Va discreta y en letra pequena: sirve para enterarse de que se esta debatiendo
 * mas sin tener que deslizar el feed. Los debates salen del endpoint ticker,
 * que el backend ordena por participacion.
 */
const debates = useDebatesStore();

const items = computed(() => debates.ticker.slice(0, 10));

/* La vuelta entera tarda mas cuanto mas contenido hay, para que la velocidad
   de lectura sea siempre parecida. */
const duracion = computed(() => `${Math.max(28, items.value.length * 9)}s`);

const votos = (id) => debates.percentagesFor(id)?.total ?? 0;

onMounted(() => {
  if (!debates.ticker.length) debates.fetchTicker();
});
</script>

<template>
  <div v-if="items.length" class="rotulo" aria-label="Lo más debatido">
    <div class="rotulo-ventana">
      <!-- La lista va dos veces seguidas: al llegar a la mitad, la animacion
           vuelve al principio y el paso se ve continuo. -->
      <div class="rotulo-cinta" :style="{ animationDuration: duracion }">
        <template v-for="vuelta in 2" :key="vuelta">
          <RouterLink
            v-for="debate in items"
            :key="`${vuelta}-${debate.id}`"
            class="rotulo-item"
            :to="{ name: 'debate', params: { id: debate.id } }"
          >
            <span class="rotulo-titulo">{{ debate.title }}</span>

            <span class="rotulo-cifras">
              <span class="material-symbols-rounded">how_to_vote</span>
              {{ votos(debate.id) }}
              <span class="material-symbols-rounded">chat_bubble</span>
              {{ debate.commentCount || 0 }}
            </span>

            <span class="rotulo-separador">•</span>
          </RouterLink>
        </template>
      </div>
    </div>
  </div>
</template>
