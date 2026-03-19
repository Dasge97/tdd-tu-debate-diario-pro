<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import AppInput from "@/components/AppInput.vue";
import AppSelect from "@/components/AppSelect.vue";
import DebateCard from "@/components/DebateCard.vue";
import { debatesService } from "@/services/debates.service";
import { useDebatesStore } from "@/stores/debates";

const router = useRouter();
const debatesStore = useDebatesStore();

const loadingCategories = ref(false);
const categories = ref([]);
const error = ref("");
const filters = reactive({
  q: "",
  sort: "new",
  category: "",
  day: "",
  authorType: "user"
});

const titleText = computed(() => "Debates abiertos por la comunidad");

const categoryOptions = computed(() => [
  { label: "Todas las categorías", value: "" },
  ...categories.value.map((category) => ({
    label: category.charAt(0).toUpperCase() + category.slice(1),
    value: category
  }))
]);

const runSearch = async () => {
  error.value = "";

  try {
    await debatesStore.search({
      q: filters.q,
      sort: filters.sort,
      category: filters.category,
      from: filters.day || undefined,
      to: filters.day || undefined,
      authorType: "user"
    });
  } catch (e) {
    error.value = e?.response?.data?.error || "No se pudieron cargar debates de la comunidad.";
  }
};

const clearFilters = async () => {
  filters.q = "";
  filters.sort = "new";
  filters.category = "";
  filters.day = "";
  await runSearch();
};

const loadCategories = async () => {
  loadingCategories.value = true;
  try {
    categories.value = await debatesService.getCategories();
  } finally {
    loadingCategories.value = false;
  }
};

const openDebate = (id) => router.push({ name: "debate", params: { id } });

onMounted(async () => {
  await Promise.all([loadCategories(), runSearch()]);
});
</script>

<template>
  <q-page class="q-px-md q-pb-lg">
    <h1 class="section-title q-mt-md q-mb-md">Comunidad</h1>

    <q-card flat bordered class="debate-surface q-mb-md community-search-card">
      <q-card-section class="filter-grid filter-grid-community">
        <div class="filter-cell filter-cell-text">
          <AppInput
            v-model="filters.q"
            dense
            label="Buscar debates"
            placeholder="título o contexto"
            @keyup.enter="runSearch"
            leading-icon="search"
          />
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
            v-model="filters.category"
            dense
            label="Categoría"
            :loading="loadingCategories"
            :options="categoryOptions"
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
          <div class="filter-actions">
            <q-btn color="primary" unelevated label="Filtrar" @click="runSearch" />
            <q-btn flat color="primary" label="Limpiar" @click="clearFilters" />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-banner v-if="error" class="bg-red-1 text-negative q-mb-md" rounded>{{ error }}</q-banner>

    <q-skeleton v-if="debatesStore.loadingSearch" type="rect" height="120px" class="q-mb-sm" />

    <div class="text-subtitle2 text-grey-8 q-mb-sm">{{ titleText }}</div>

    <DebateCard
      v-for="debate in debatesStore.searchResults"
      :key="debate.id"
      :debate="debate"
      @open="openDebate"
    />

    <q-banner v-if="!debatesStore.loadingSearch && debatesStore.searchResults.length === 0" rounded class="bg-grey-2 q-mt-sm">
      No hay propuestas de usuarios para esos filtros.
    </q-banner>
  </q-page>
</template>
