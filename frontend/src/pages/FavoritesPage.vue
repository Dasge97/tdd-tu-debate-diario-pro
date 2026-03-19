<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import DebateCard from "@/components/DebateCard.vue";
import { useFavoritesStore } from "@/stores/favorites";
import { useUsersStore } from "@/stores/users";

const router = useRouter();
const favoritesStore = useFavoritesStore();
const usersStore = useUsersStore();

const openDebate = (id) => router.push({ name: "debate", params: { id } });

onMounted(async () => {
  if (usersStore.isAuthenticated) {
    await favoritesStore.fetchFavorites();
  }
});
</script>

<template>
  <q-page class="q-px-md q-pb-lg">
    <h1 class="section-title q-mt-md q-mb-md">Favoritos</h1>

    <q-banner v-if="!usersStore.isAuthenticated" rounded class="bg-amber-1 text-amber-10 q-mb-md">
      Inicia sesión para gestionar tus debates guardados.
    </q-banner>

    <q-skeleton v-if="favoritesStore.loading" type="rect" height="140px" class="q-mb-sm" />
    <DebateCard
      v-for="debate in favoritesStore.items"
      :key="debate.id"
      :debate="debate"
      @open="openDebate"
    />

    <q-banner
      v-if="usersStore.isAuthenticated && !favoritesStore.loading && favoritesStore.items.length === 0"
      class="bg-grey-2"
      rounded
    >
      Aún no guardaste debates en favoritos.
    </q-banner>
  </q-page>
</template>
