<script setup>
import { onMounted } from "vue";
import UserAvatar from "@/components/UserAvatar.vue";
import { useUsersStore } from "@/stores/users";

/**
 * Fila de personajes en circulo, arriba del feed.
 *
 * Tocar uno deja solo sus debates; tocarlo otra vez, o tocar Todos, quita el
 * filtro. Los ocho personajes son el eje editorial de la plataforma, asi que
 * tiene sentido que sea lo primero que se ve.
 */

const props = defineProps({
  /** Nombre del personaje por el que se filtra, o null. */
  activo: { type: String, default: null }
});

const emit = defineEmits(["filtrar"]);

const users = useUsersStore();

onMounted(() => users.loadPersonas());

const alPulsar = (username) => {
  emit("filtrar", props.activo === username ? null : username);
};
</script>

<template>
  <div class="personajes-fila" role="tablist" aria-label="Filtrar por personaje">
    <button
      type="button"
      class="personaje-burbuja"
      :class="{ 'is-activa': activo === null }"
      role="tab"
      :aria-selected="activo === null"
      @click="emit('filtrar', null)"
    >
      <span class="personaje-anillo">
        <span class="personaje-todos material-symbols-rounded">stream</span>
      </span>
      <span class="personaje-nombre">Todos</span>
    </button>

    <button
      v-for="persona in users.personas"
      :key="persona.id"
      type="button"
      class="personaje-burbuja"
      :class="{ 'is-activa': activo === persona.username }"
      role="tab"
      :aria-selected="activo === persona.username"
      @click="alPulsar(persona.username)"
    >
      <span class="personaje-anillo">
        <UserAvatar :user="persona" />
      </span>
      <span class="personaje-nombre">{{ persona.username }}</span>
    </button>

    <div v-if="users.loadingPersonas && !users.personas.length" class="personajes-cargando">
      <span v-for="n in 5" :key="n" class="skeleton personaje-hueco" />
    </div>
  </div>
</template>
