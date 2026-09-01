<script setup>
import { computed, onMounted } from "vue";
import UserAvatar from "@/components/UserAvatar.vue";
import { useDebatesStore } from "@/stores/debates";
import { useUsersStore } from "@/stores/users";

/**
 * Columna lateral de escritorio. En movil no se pinta: la regla .lateral la
 * oculta por debajo de 1000 px, donde los destacados van en la cinta de arriba.
 */
const props = defineProps({
  excluirId: { type: [String, Number], default: null }
});

const debates = useDebatesStore();
const users = useUsersStore();

const destacados = computed(() =>
  debates.ticker.filter((d) => Number(d.id) !== Number(props.excluirId)).slice(0, 6)
);

const protagonistas = computed(() => users.protagonistas.slice(0, 5));

onMounted(() => {
  if (!debates.ticker.length) debates.fetchTicker();
  if (!users.protagonistas.length) users.loadProtagonistas().catch(() => {});
});
</script>

<template>
  <aside class="lateral">
    <div v-if="destacados.length" class="surface surface-pad lateral-bloque">
      <h2 class="lateral-titulo">Los más debatidos</h2>

      <RouterLink
        v-for="debate in destacados"
        :key="debate.id"
        class="lateral-item"
        :to="{ name: 'debate', params: { id: debate.id } }"
      >
        <div class="lateral-item-marca">
          {{ debate.createdBy?.username || "TuDebateDiario" }}
        </div>
        <div class="lateral-item-titulo">{{ debate.title }}</div>
      </RouterLink>
    </div>

    <div v-if="protagonistas.length" class="surface surface-pad lateral-bloque">
      <h2 class="lateral-titulo">Protagonistas</h2>

      <RouterLink
        v-for="(user, index) in protagonistas"
        :key="user.id"
        class="lateral-item"
        style="display: flex; align-items: center; gap: 10px"
        :to="{ name: 'user', params: { username: user.username } }"
      >
        <span class="rank-badge" :class="{ 'is-top': index < 3 }">{{ index + 1 }}</span>
        <UserAvatar :user="user" size="sm" />
        <span style="flex: 1 1 auto; min-width: 0">
          <span class="list-row-title">{{ user.username }}</span>
          <span class="list-row-sub">{{ user.reliabilityScore ?? 0 }} de fiabilidad</span>
        </span>
      </RouterLink>
    </div>

    <div class="surface surface-pad lateral-bloque">
      <h2 class="lateral-titulo">Propón un debate</h2>
      <p class="text-muted" style="margin: 0 0 14px; font-size: 0.88rem; line-height: 1.55">
        ¿Hay un tema de actualidad que merece discutirse? Escríbelo y la comunidad decidirá.
      </p>
      <RouterLink class="btn btn-outline btn-block btn-sm" :to="{ name: 'propose' }">
        Proponer
      </RouterLink>
    </div>
  </aside>
</template>
