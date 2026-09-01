<script setup>
import { onBeforeUnmount, ref, watch } from "vue";
import DebateCard from "@/components/DebateCard.vue";
import Esqueleto from "@/components/Esqueleto.vue";
import EmptyState from "@/components/EmptyState.vue";
import { debatesService } from "@/services";
import { useDebatesStore } from "@/stores/debates";
import { useUiStore } from "@/stores/ui";
import { errorMessage } from "@/api/client";

const debates = useDebatesStore();
const ui = useUiStore();

const query = ref("");
const results = ref([]);
const searching = ref(false);
const searched = ref(false);

let debounceTimer = null;

const run = async () => {
  const term = query.value.trim();

  if (term.length < 2) {
    results.value = [];
    searched.value = false;
    return;
  }

  searching.value = true;
  try {
    const data = await debatesService.search(term);
    results.value = data;
    debates.cache(data);
    debates.loadPositionsFor(data);
    searched.value = true;
  } catch (error) {
    ui.error(errorMessage(error, "La búsqueda ha fallado."));
  } finally {
    searching.value = false;
  }
};

/* Espera a que el usuario deje de escribir antes de llamar a la API. */
watch(query, () => {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(run, 400);
});

onBeforeUnmount(() => window.clearTimeout(debounceTimer));
</script>

<template>
  <section>
    <div class="search-bar" style="margin-bottom: 16px">
      <span class="material-symbols-rounded" style="color: #667085">search</span>
      <input
        v-model="query"
        type="search"
        enterkeyhint="search"
        placeholder="Busca un debate…"
        aria-label="Buscar debates"
        @keydown.enter="run"
      />
      <button
        v-if="query"
        type="button"
        class="icon-btn"
        aria-label="Limpiar búsqueda"
        @click="query = ''"
      >
        <span class="material-symbols-rounded">close</span>
      </button>
    </div>

    <Esqueleto v-if="searching" tipo="tarjetas" :cantidad="2" />

    <DebateCard v-for="debate in results" :key="debate.id" :debate="debate" />

    <EmptyState
      v-if="!searching && searched && !results.length"
      icon="search_off"
      title="Sin resultados"
      :text="`No hemos encontrado debates para «${query.trim()}».`"
    />

    <EmptyState
      v-else-if="!searching && !searched"
      icon="search"
      title="Busca por título o tema"
      text="Escribe al menos dos letras para empezar."
    />
  </section>
</template>
