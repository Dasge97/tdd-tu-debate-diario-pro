<script setup>
import { computed, onMounted, ref } from "vue";
import DebateCard from "@/components/DebateCard.vue";
import DebateSkeleton from "@/components/DebateSkeleton.vue";
import EmptyState from "@/components/EmptyState.vue";
import Lateral from "@/components/Lateral.vue";
import FilaPersonajes from "@/components/FilaPersonajes.vue";
import RotuloCalientes from "@/components/RotuloCalientes.vue";
import IndicadorRecarga from "@/components/IndicadorRecarga.vue";
import { useDebatesStore } from "@/stores/debates";
import { useTirarParaActualizar } from "@/composables/useTirarParaActualizar";
import { useCargaContinua } from "@/composables/useCargaContinua";
import { etiquetaDia } from "@/utils/format";

const debates = useDebatesStore();

const FILTRO = "tdd.personaFiltro";

const personaFiltro = ref(localStorage.getItem(FILTRO) || null);

/**
 * El feed se agrupa por dia, para poner una linea con la fecha entre unos
 * debates y otros, en vez de partir la pantalla en pestanas.
 */
const grupos = computed(() => {
  const porDia = [];

  debates.feed.forEach((debate) => {
    const dia = debate.dayDate;
    const ultimo = porDia[porDia.length - 1];

    if (ultimo && ultimo.dia === dia) {
      ultimo.debates.push(debate);
    } else {
      porDia.push({ dia, debates: [debate] });
    }
  });

  return porDia;
});

const cargar = () => debates.cargarFeed({ persona: personaFiltro.value });

const filtrar = (username) => {
  personaFiltro.value = username;

  if (username) {
    localStorage.setItem(FILTRO, username);
  } else {
    localStorage.removeItem(FILTRO);
  }

  debates.cargarFeed({ persona: username, forzar: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
};

onMounted(() => {
  cargar();
  debates.fetchTicker();
});

/* Deslizar hacia abajo recarga el feed. */
const { avance, recargando } = useTirarParaActualizar(async () => {
  await debates.cargarFeed({ persona: personaFiltro.value, forzar: true });
  debates.fetchTicker();
});

/* Al llegar al final se pide la pagina siguiente. */
const { centinela, cargando: cargandoMas, seAcabo } = useCargaContinua(() =>
  debates.cargarMasFeed()
);
</script>

<template>
  <section class="con-lateral">
    <IndicadorRecarga :avance="avance" :recargando="recargando" />

    <div>
      <FilaPersonajes :activo="personaFiltro" @filtrar="filtrar" />

      <p v-if="debates.error" class="form-error">{{ debates.error }}</p>

      <DebateSkeleton v-if="debates.cargandoFeed && !debates.feed.length" />

      <template v-for="(grupo, indice) in grupos" :key="grupo.dia">
        <div class="dia-separador">{{ etiquetaDia(grupo.dia) }}</div>

        <!-- Solo bajo la primera fecha: es un resumen, no un adorno repetido. -->
        <RotuloCalientes v-if="indice === 0 && !personaFiltro" />

        <DebateCard v-for="debate in grupo.debates" :key="debate.id" :debate="debate" />
      </template>

      <EmptyState
        v-if="!debates.cargandoFeed && !debates.feed.length"
        icon="forum"
        :title="personaFiltro ? 'Sin debates de este personaje' : 'Todavía no hay debates'"
        :text="
          personaFiltro
            ? 'Prueba con otro personaje o quita el filtro.'
            : 'Los debates del día se publican cada mañana. Vuelve en un rato.'
        "
      />

      <div ref="centinela" />

      <div v-if="cargandoMas" class="skeleton" style="height: 180px; margin-bottom: 14px" />

      <p
        v-else-if="seAcabo && debates.feed.length > 8"
        class="text-muted"
        style="text-align: center; padding: 18px 0; font-size: 0.86rem"
      >
        No hay más debates por ahora.
      </p>
    </div>

    <Lateral />
  </section>
</template>
