<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import DebateCard from "@/components/DebateCard.vue";
import DebateSkeleton from "@/components/DebateSkeleton.vue";
import EmptyState from "@/components/EmptyState.vue";
import Esqueleto from "@/components/Esqueleto.vue";
import Lateral from "@/components/Lateral.vue";
import IndicadorRecarga from "@/components/IndicadorRecarga.vue";
import { useTirarParaActualizar } from "@/composables/useTirarParaActualizar";
import { useCargaContinua } from "@/composables/useCargaContinua";
import UserAvatar from "@/components/UserAvatar.vue";
import { useDebatesStore } from "@/stores/debates";
import { useUsersStore } from "@/stores/users";

/** Las tres pestañas de la pantalla de inicio de la app Flutter. */
const TABS = [
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Semana" },
  { key: "protagonistas", label: "Protagonistas" }
];

const TAB_KEY = "tdd.homeTab";

const router = useRouter();
const debates = useDebatesStore();
const users = useUsersStore();

const tab = ref(localStorage.getItem(TAB_KEY) || "hoy");

const today = computed(() => debates.today);
const week = computed(() => debates.topWeek);

const loadTab = () => {
  if (tab.value === "hoy") debates.fetchToday();
  if (tab.value === "semana") debates.fetchTopWeek();
  if (tab.value === "protagonistas") users.loadProtagonistas();
};

watch(tab, (value) => {
  localStorage.setItem(TAB_KEY, value);
  loadTab();
});

onMounted(() => {
  debates.fetchTicker();
  loadTab();
});

const openDebate = (id) => router.push({ name: "debate", params: { id } });

/* Deslizar hacia abajo recarga la pestana que se este viendo. */
const { avance, recargando } = useTirarParaActualizar(async () => {
  if (tab.value === "hoy") await debates.fetchToday(true);
  if (tab.value === "semana") await debates.fetchTopWeek(true);
  if (tab.value === "protagonistas") await users.loadProtagonistas(true);
  debates.fetchTicker();
});

/* Al llegar al final de la lista se pide la pagina siguiente. */
const { centinela, cargando: cargandoMas, seAcabo } = useCargaContinua(() =>
  debates.cargarMasHoy()
);
</script>

<template>
  <section class="con-lateral">
    <IndicadorRecarga :avance="avance" :recargando="recargando" />

    <div>
    <!-- Cinta de titulares: los debates con más participación, deslizables. -->
      <div v-if="debates.ticker.length" class="ticker solo-movil" aria-label="Debates destacados">
      <button
        v-for="item in debates.ticker.slice(0, 10)"
        :key="item.id"
        type="button"
        class="ticker-item"
        @click="openDebate(item.id)"
      >
        <div class="mini-label" style="margin-bottom: 6px">
          {{ item.createdBy?.username || "TuDebateDiario" }}
        </div>
        <div class="ticker-item-title">{{ item.title }}</div>
      </button>
    </div>

    <div class="tabs" role="tablist">
      <button
        v-for="item in TABS"
        :key="item.key"
        type="button"
        role="tab"
        class="tab"
        :class="{ 'is-active': tab === item.key }"
        :aria-selected="tab === item.key"
        @click="tab = item.key"
      >
        {{ item.label }}
      </button>
    </div>

    <!-- HOY -->
    <div v-if="tab === 'hoy'">
      <div class="section-head">
        <h2 class="section-title">
          {{ debates.todayEsReciente ? "Últimos debates" : "Debates de hoy" }}
        </h2>
        <RouterLink class="btn btn-ghost btn-sm" :to="{ name: 'propose' }">Proponer</RouterLink>
      </div>

      <p v-if="debates.error" class="form-error">{{ debates.error }}</p>

      <DebateSkeleton v-if="debates.loadingToday && !today.length" />

      <DebateCard v-for="debate in today" :key="debate.id" :debate="debate" />

      <EmptyState
        v-if="!debates.loadingToday && !today.length"
        icon="forum"
        title="Todavía no hay debates hoy"
        text="Los debates del día se publican cada mañana. Vuelve en un rato."
      />

      <div ref="centinela" />

      <div v-if="cargandoMas" class="skeleton" style="height: 180px; margin-bottom: 14px" />

      <p
        v-else-if="seAcabo && today.length > 8"
        class="text-muted"
        style="text-align: center; padding: 18px 0; font-size: 0.86rem"
      >
        No hay más debates por ahora.
      </p>
    </div>

    <!-- SEMANA -->
    <div v-else-if="tab === 'semana'">
      <div class="section-head">
        <h2 class="section-title">Lo más debatido de la semana</h2>
      </div>

      <DebateSkeleton v-if="debates.loadingWeek && !week.length" />

      <DebateCard v-for="debate in week" :key="debate.id" :debate="debate" />

      <EmptyState
        v-if="!debates.loadingWeek && !week.length"
        icon="calendar_month"
        title="Sin debates esta semana"
        text="Aún no hay suficiente participación para hacer un ranking semanal."
      />
    </div>

    <!-- PROTAGONISTAS -->
    <div v-else>
      <div class="section-head">
        <h2 class="section-title">Protagonistas</h2>
        <span class="text-muted" style="font-size: 0.82rem">Por fiabilidad</span>
      </div>

      <Esqueleto v-if="users.loadingProtagonistas && !users.protagonistas.length" tipo="lista" :cantidad="5" />

      <div v-else-if="users.protagonistas.length" class="surface list-card">
        <RouterLink
          v-for="(user, index) in users.protagonistas"
          :key="user.id"
          class="list-row"
          :to="{ name: 'user', params: { username: user.username } }"
        >
          <span class="rank-badge" :class="{ 'is-top': index < 3 }">{{ index + 1 }}</span>
          <UserAvatar :user="user" size="sm" />
          <span class="list-row-main">
            <span class="list-row-title">{{ user.username }}</span>
            <span class="list-row-sub">{{ user.profileTagline || user.bio || "Miembro de la comunidad" }}</span>
          </span>
          <span class="list-row-aside">
            <span class="meta-pill">{{ user.reliabilityScore ?? 0 }}</span>
          </span>
        </RouterLink>
      </div>

      <EmptyState
        v-else
        icon="social_leaderboard"
        title="Ranking vacío"
        text="Cuando la comunidad empiece a comentar, aquí aparecerán los protagonistas."
      />
      </div>
    </div>

    <Lateral />
  </section>
</template>
