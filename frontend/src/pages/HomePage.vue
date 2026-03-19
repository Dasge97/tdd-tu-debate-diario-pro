<script setup>
import { computed, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import HeroSection from "@/components/HeroSection.vue";
import DebateCarousel from "@/components/DebateCarousel.vue";
import DebateCard from "@/components/DebateCard.vue";
import CommunityTodaySection from "@/components/CommunityTodaySection.vue";
import { useDebatesStore } from "@/stores/debates";
import { useUsersStore } from "@/stores/users";
import { useStatsStore } from "@/stores/stats";
import { useActivityStore } from "@/stores/activity";

const router = useRouter();
const debatesStore = useDebatesStore();
const usersStore = useUsersStore();
const statsStore = useStatsStore();
const activityStore = useActivityStore();
let activityRefreshTimer = null;

const openDebate = (id) => router.push({ name: "debate", params: { id } });
const goToCommunity = () => router.push({ name: "comunidad" });
const goToTodaySection = () => {
  const node = document.getElementById("debates-hoy");
  node?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const debateMomentum = (debate) => {
  const raw = debate?.positionsRaw || {};
  const votes = Number(raw.support || 0) + Number(raw.oppose || 0) + Number(raw.neutral || 0);
  const comments = Number(debate?.commentCount || 0);
  return votes + comments * 3;
};

const hottestDebate = computed(() => {
  if (!debatesStore.today.length) return null;

  return [...debatesStore.today].sort((a, b) => debateMomentum(b) - debateMomentum(a))[0] || null;
});

const stats = computed(() => ({
  comentariosHoy: statsStore.comentariosHoy,
  participantesHoy: statsStore.participantesHoy,
  debatesActivos: statsStore.debatesActivos,
  votosEmitidos: statsStore.votosEmitidos,
  promedioComentariosPorDebate: statsStore.promedioComentariosPorDebate
}));

const toneByType = {
  debate_created: "debate",
  comment_created: "comment",
  comment_replied: "comment",
  comment_voted: "vote",
  position_set: "vote",
  position_changed: "vote"
};

const liveActivity = computed(() =>
  activityStore.items.map((item) => ({
    id: item.id,
    tone: toneByType[item.type] || "default",
    actor: item.user?.username || "Usuario",
    message: item.message || "ha realizado una actividad",
    createdAt: item.createdAt || item.created_at || ""
  }))
);

onMounted(async () => {
  await Promise.all([
    debatesStore.fetchToday(),
    usersStore.fetchTopUsers(),
    activityStore.fetchRecent(8)
  ]);
  statsStore.computeFromDebates(debatesStore.today, usersStore.topUsers);

  activityRefreshTimer = window.setInterval(() => {
    activityStore.fetchRecent(8);
  }, 15000);
});

onBeforeUnmount(() => {
  if (activityRefreshTimer) {
    window.clearInterval(activityRefreshTimer);
    activityRefreshTimer = null;
  }
});
</script>

<template>
  <q-page class="home-page">
    <HeroSection
      :highlighted-debate="hottestDebate"
      @open-highlight="openDebate"
      @go-today="goToTodaySection"
      @go-community="goToCommunity"
    />

    <DebateCarousel :debates="debatesStore.today" @open="openDebate" />

    <section class="q-px-md q-pb-xl home-dashboard">
      <div class="home-dashboard-grid">
        <div class="home-primary-column" id="debates-hoy">
          <div class="home-section-intro q-mb-md">
            <h2 class="section-title q-my-none">Propuestas de hoy</h2>
          </div>

          <q-banner v-if="debatesStore.error" class="bg-red-1 text-negative q-mb-md" rounded>
            {{ debatesStore.error }}
          </q-banner>

          <q-skeleton v-if="debatesStore.loadingToday" type="rect" height="160px" class="q-mb-md" />
          <DebateCard
            v-for="debate in debatesStore.today"
            :key="debate.id"
            :debate="debate"
            @open="openDebate"
          />
        </div>

        <div class="home-secondary-column">
          <CommunityTodaySection
            :top-users="usersStore.topUsers"
            :stats="stats"
            :activity-items="liveActivity"
          />
        </div>
      </div>
    </section>
  </q-page>
</template>
