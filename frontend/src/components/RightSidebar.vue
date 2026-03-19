<script setup>
defineProps({
  topUsers: {
    type: Array,
    default: () => []
  },
  stats: {
    type: Object,
    required: true
  }
});
</script>

<template>
  <div class="q-gutter-md right-sidebar">
    <q-card flat bordered class="debate-surface side-panel">
      <q-card-section>
        <div class="text-overline text-grey-7 q-mb-sm panel-heading">Voces con criterio</div>
        <q-list dense>
          <q-item v-for="user in topUsers" :key="user.id || user.username" class="voice-item">
            <q-item-section>
              <q-item-label class="voice-name">{{ user.username || user.name }}</q-item-label>
              <q-item-label caption>Índice de criterio: {{ user.reliabilityScore ?? user.reliability_score ?? user.score ?? 0 }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="topUsers.length === 0">
            <q-item-section>
              <q-item-label caption>Aún no hay datos disponibles.</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="debate-surface side-panel">
      <q-card-section>
        <div class="text-overline text-grey-7 q-mb-sm panel-heading">Actividad de hoy</div>
        <q-list dense>
          <q-item class="stat-item">
            <q-item-section>Comentarios hoy</q-item-section>
            <q-item-section side>{{ stats.comentariosHoy }}</q-item-section>
          </q-item>
          <q-item class="stat-item">
            <q-item-section>Participantes hoy</q-item-section>
            <q-item-section side>{{ stats.participantesHoy }}</q-item-section>
          </q-item>
          <q-item class="stat-item">
            <q-item-section>Debates activos</q-item-section>
            <q-item-section side>{{ stats.debatesActivos }}</q-item-section>
          </q-item>
          <q-item class="stat-item">
            <q-item-section>Votos emitidos</q-item-section>
            <q-item-section side>{{ stats.votosEmitidos }}</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </div>
</template>
