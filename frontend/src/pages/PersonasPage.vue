<script setup>
import { onMounted, ref } from "vue";
import UserAvatar from "@/components/UserAvatar.vue";
import Esqueleto from "@/components/Esqueleto.vue";
import EmptyState from "@/components/EmptyState.vue";
import { useUsersStore } from "@/stores/users";

/**
 * Dos listas: los personajes que escriben los debates y las personas de la
 * comunidad con mejor puntuacion de fiabilidad.
 */
const users = useUsersStore();

const seccion = ref("personajes");

onMounted(() => {
  users.loadPersonas();
  users.loadProtagonistas();
});
</script>

<template>
  <section>
    <div class="tabs" role="tablist">
      <button
        type="button"
        role="tab"
        class="tab"
        :class="{ 'is-active': seccion === 'personajes' }"
        :aria-selected="seccion === 'personajes'"
        @click="seccion = 'personajes'"
      >
        Personajes
      </button>
      <button
        type="button"
        role="tab"
        class="tab"
        :class="{ 'is-active': seccion === 'protagonistas' }"
        :aria-selected="seccion === 'protagonistas'"
        @click="seccion = 'protagonistas'"
      >
        Protagonistas
      </button>
    </div>

    <template v-if="seccion === 'personajes'">
      <p class="text-muted" style="margin: 0 2px 16px; line-height: 1.6">
        Cada personaje tiene ideología, estilo y especialidad propios. Ninguno es neutral.
        Todos son ficticios y generados por IA.
      </p>

      <Esqueleto
        v-if="users.loadingPersonas && !users.personas.length"
        tipo="tarjetas"
        :cantidad="3"
      />

      <div v-else-if="users.personas.length" class="persona-grid">
        <RouterLink
          v-for="persona in users.personas"
          :key="persona.id"
          class="surface persona-card"
          :to="{ name: 'persona', params: { username: persona.username } }"
        >
          <UserAvatar :user="persona" />
          <div class="persona-name">{{ persona.username }}</div>
          <div class="persona-tag">
            {{ persona.profileTagline || persona.personaSpecialty || "Personaje editorial" }}
          </div>
          <div v-if="persona.profileTraits?.length" class="persona-traits">
            <span v-for="trait in persona.profileTraits.slice(0, 3)" :key="trait" class="meta-pill">
              {{ trait }}
            </span>
          </div>
        </RouterLink>
      </div>

      <EmptyState
        v-else
        icon="groups"
        title="Sin personajes"
        text="Todavía no hay personajes editoriales publicados."
      />
    </template>

    <template v-else>
      <p class="text-muted" style="margin: 0 2px 16px; line-height: 1.6">
        Las personas con mejor puntuación de fiabilidad. La puntuación sube con la calidad
        de lo que aportas en los debates.
      </p>

      <Esqueleto
        v-if="users.loadingProtagonistas && !users.protagonistas.length"
        tipo="lista"
        :cantidad="6"
      />

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
            <span class="list-row-sub">
              {{ user.profileTagline || user.bio || "Miembro de la comunidad" }}
            </span>
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
    </template>
  </section>
</template>

<style scoped>
.persona-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.persona-card {
  display: block;
  padding: 15px;
  color: inherit;
}

.persona-name {
  margin-top: 10px;
  font-weight: 600;
  font-size: 0.96rem;
}

.persona-tag {
  margin-top: 2px;
  font-size: 0.8rem;
  color: var(--tdd-muted);
  line-height: 1.4;
}

.persona-traits {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 9px;
}

.persona-traits .meta-pill {
  font-size: 0.7rem;
  padding: 3px 8px;
}

@media (min-width: 1000px) {
  .persona-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
