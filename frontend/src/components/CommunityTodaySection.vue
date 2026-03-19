<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";

const props = defineProps({
  topUsers: {
    type: Array,
    default: () => []
  },
  activityItems: {
    type: Array,
    default: () => []
  },
  stats: {
    type: Object,
    required: true
  }
});

const router = useRouter();

const hasUsers = computed(() => props.topUsers.length > 0);
const hasStats = computed(() => {
  const values = [
    Number(props.stats?.comentariosHoy || 0),
    Number(props.stats?.participantesHoy || 0),
    Number(props.stats?.debatesActivos || 0),
    Number(props.stats?.votosEmitidos || 0),
    Number(props.stats?.promedioComentariosPorDebate || 0)
  ];
  return values.some((value) => value > 0);
});

const hasActivity = computed(() => props.activityItems.length > 0);

const activityPalette = [
  { text: "#b54708", soft: "#fff1e8" },
  { text: "#1d4ed8", soft: "#edf4ff" },
  { text: "#047857", soft: "#e8fbf3" },
  { text: "#7c3aed", soft: "#f3ecff" },
  { text: "#be185d", soft: "#fff0f6" },
  { text: "#0f766e", soft: "#e6fbf8" }
];

const decoratedActivity = computed(() => {
  const actorColorMap = new Map();
  let paletteIndex = 0;

  return props.activityItems.map((item) => {
    const actorKey = String(item.actor || "usuario").toLowerCase();

    if (!actorColorMap.has(actorKey)) {
      actorColorMap.set(actorKey, activityPalette[paletteIndex % activityPalette.length]);
      paletteIndex += 1;
    }

    return {
      ...item,
      accent: actorColorMap.get(actorKey),
      timeLabel: formatActivityTime(item.createdAt)
    };
  });
});

function formatActivityTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (targetDay.getTime() === today.getTime()) {
    return new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  if (targetDay.getTime() === yesterday.getTime()) {
    return "Ayer";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function openProfile(username) {
  if (!username) return;
  router.push({ name: "perfil", params: { username } });
}
</script>

<template>
  <section class="community-section">
    <div class="community-stack">
      <q-card flat bordered class="debate-surface community-card full-width">
        <q-card-section class="community-card-header">
          <div class="text-grey-9 panel-heading community-card-title">Voces con criterio</div>
        </q-card-section>
        <q-card-section class="community-card-content">
          <q-list dense v-if="hasUsers">
            <q-item v-for="user in topUsers.slice(0, 5)" :key="user.id || user.username" class="voice-item compact-row-item">
              <q-item-section>
                <div class="voice-row">
                  <button
                    type="button"
                    class="voice-name compact-voice-name voice-name-link"
                    @click="openProfile(user.username || user.name)"
                  >
                    {{ user.username || user.name }}
                  </button>
                  <span class="compact-voice-score">
                    {{ user.reliabilityScore ?? user.reliability_score ?? user.score ?? 0 }}
                  </span>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="community-placeholder">Aún no hay datos disponibles</div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="debate-surface community-card full-width">
        <q-card-section class="community-card-header">
          <div class="text-grey-9 panel-heading community-card-title">Pulso del día</div>
        </q-card-section>
        <q-card-section class="community-card-content">
          <div v-if="hasStats" class="community-stats-grid">
            <div class="community-stat-box">
              <span>Debates activos</span>
              <strong>{{ stats.debatesActivos }}</strong>
            </div>
            <div class="community-stat-box">
              <span>Votos emitidos</span>
              <strong>{{ stats.votosEmitidos }}</strong>
            </div>
            <div class="community-stat-box">
              <span>Comentarios hoy</span>
              <strong>{{ stats.comentariosHoy }}</strong>
            </div>
            <div class="community-stat-box">
              <span>Participantes</span>
              <strong>{{ stats.participantesHoy }}</strong>
            </div>
          </div>
          <div v-else class="community-placeholder">Aún no hay datos disponibles</div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="debate-surface community-card full-width">
        <q-card-section class="community-card-header">
          <div class="text-grey-9 panel-heading community-card-title">Actividad en vivo</div>
        </q-card-section>
        <q-card-section class="community-card-content">
          <div v-if="hasActivity" class="activity-frame">
            <div class="activity-stream">
              <div v-for="item in decoratedActivity" :key="item.id" class="activity-row">
                <div class="activity-copy">
                  <div class="activity-line">
                    <div class="activity-title">
                      <span class="activity-actor-text" :style="{ color: item.accent.text }">{{ item.actor }}</span>
                      <span>{{ item.message }}</span>
                    </div>
                    <div v-if="item.timeLabel" class="activity-meta">
                      {{ item.timeLabel }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="community-placeholder">Aún no hay datos disponibles</div>
        </q-card-section>
      </q-card>
    </div>
  </section>
</template>
