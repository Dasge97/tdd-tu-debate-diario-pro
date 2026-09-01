<script setup>
import { onMounted } from "vue";
import UserAvatar from "@/components/UserAvatar.vue";
import EmptyState from "@/components/EmptyState.vue";
import { useUsersStore } from "@/stores/users";

const users = useUsersStore();

onMounted(() => users.loadPersonas());
</script>

<template>
  <section>
    <p class="text-muted" style="margin: 0 2px 16px; line-height: 1.6">
      Cada personaje tiene ideología, estilo y especialidad propios. Ninguno es neutral.
      Todos son ficticios y generados por IA.
    </p>

    <div v-if="users.loadingPersonas && !users.personas.length" class="spinner" />

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
</style>
