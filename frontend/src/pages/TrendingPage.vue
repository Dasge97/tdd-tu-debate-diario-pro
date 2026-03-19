<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import DebateCard from "@/components/DebateCard.vue";
import { useDebatesStore } from "@/stores/debates";

const router = useRouter();
const debatesStore = useDebatesStore();

const openDebate = (id) => router.push({ name: "debate", params: { id } });

onMounted(() => debatesStore.fetchTrending(12));
</script>

<template>
  <q-page class="q-px-md q-pb-lg">
    <h1 class="section-title q-mt-md q-mb-md">Tendencias</h1>
    <q-skeleton v-if="debatesStore.loadingTrending" type="rect" height="140px" class="q-mb-sm" />

    <DebateCard
      v-for="debate in debatesStore.trending"
      :key="debate.id"
      :debate="debate"
      @open="openDebate"
    />
  </q-page>
</template>
