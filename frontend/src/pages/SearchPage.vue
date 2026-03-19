<script setup>
import { reactive, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import AppInput from "@/components/AppInput.vue";
import AppSelect from "@/components/AppSelect.vue";
import DebateCard from "@/components/DebateCard.vue";
import { useDebatesStore } from "@/stores/debates";

const router = useRouter();
const route = useRoute();
const debatesStore = useDebatesStore();

const filters = reactive({
  q: String(route.query.q || ""),
  sort: "new",
  position: "",
  day: ""
});

const runSearch = async () => {
  await debatesStore.search({
    q: filters.q,
    sort: filters.sort,
    position: filters.position,
    from: filters.day || undefined,
    to: filters.day || undefined
  });
  router.replace({ name: "buscar", query: { q: filters.q || undefined } });
};

const openDebate = (id) => router.push({ name: "debate", params: { id } });

onMounted(runSearch);
</script>

<template>
  <q-page class="q-px-md q-pb-lg">
    <h1 class="section-title q-mt-md q-mb-md">Buscar debates</h1>

    <q-card flat bordered class="debate-surface q-mb-md">
      <q-card-section class="filter-grid filter-grid-search">
        <div class="filter-cell filter-cell-text">
          <AppInput v-model="filters.q" dense label="Texto" placeholder="Busca por título o contenido" />
        </div>
        <div class="filter-cell">
          <AppSelect
            v-model="filters.sort"
            dense
            label="Orden"
            :options="[
              { label: 'Más nuevos', value: 'new' },
              { label: 'Más antiguos', value: 'old' },
              { label: 'Más comentarios', value: 'comments' },
              { label: 'Más votos', value: 'votes' }
            ]"
          />
        </div>
        <div class="filter-cell">
          <AppSelect
            v-model="filters.position"
            dense
            label="Posición"
            :options="[
              { label: 'Todas', value: '' },
              { label: 'A favor', value: 'support' },
              { label: 'En contra', value: 'oppose' },
              { label: 'Neutral', value: 'neutral' }
            ]"
          />
        </div>
        <div class="filter-cell">
          <AppInput
            v-model="filters.day"
            dense
            type="date"
            label="Fecha"
          />
        </div>
        <div class="filter-cell filter-cell-actions">
          <div class="filter-actions filter-actions-single">
            <q-btn color="primary" unelevated label="Buscar" @click="runSearch" />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-skeleton v-if="debatesStore.loadingSearch" type="rect" height="140px" class="q-mb-sm" />
    <DebateCard
      v-for="debate in debatesStore.searchResults"
      :key="debate.id"
      :debate="debate"
      @open="openDebate"
    />
    <q-banner
      v-if="!debatesStore.loadingSearch && debatesStore.searchResults.length === 0"
      rounded
      class="bg-grey-2"
    >
      No se encontraron debates para esos filtros.
    </q-banner>
  </q-page>
</template>
