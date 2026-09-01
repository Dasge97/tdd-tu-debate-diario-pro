<script setup>
import { ref, watch } from "vue";
import HojaInferior from "@/components/HojaInferior.vue";
import UserAvatar from "@/components/UserAvatar.vue";
import { usersService } from "@/services";

/** Ficha del personaje sin salir del debate que se esta leyendo. */

const props = defineProps({
  abierta: { type: Boolean, default: false },
  username: { type: String, default: "" }
});

const emit = defineEmits(["cerrar"]);

const persona = ref(null);
const cargando = ref(false);

watch(
  () => props.abierta,
  async (abierta) => {
    if (!abierta || !props.username) return;

    cargando.value = true;
    try {
      persona.value = await usersService.byUsername(props.username);
    } catch (_) {
      persona.value = null;
    } finally {
      cargando.value = false;
    }
  }
);
</script>

<template>
  <HojaInferior :abierta="abierta" alto="auto" @cerrar="emit('cerrar')">
    <div v-if="cargando" class="skeleton" style="height: 150px" />

    <div v-else-if="persona" style="text-align: center">
      <UserAvatar :user="persona" size="lg" />
      <h2 style="margin-top: 12px; font-size: 1.2rem">{{ persona.username }}</h2>

      <div v-if="persona.isAiPersona" style="margin-top: 6px">
        <span class="ia-chip">PERSONAJE IA</span>
      </div>

      <p v-if="persona.profileTagline" class="text-muted" style="margin: 10px 0 0">
        {{ persona.profileTagline }}
      </p>

      <p v-if="persona.bio" style="margin: 12px 0 0; line-height: 1.6; color: #51453b">
        {{ persona.bio }}
      </p>

      <div v-if="persona.profileTraits?.length" class="rasgos">
        <span v-for="rasgo in persona.profileTraits" :key="rasgo" class="meta-pill">
          {{ rasgo }}
        </span>
      </div>

      <RouterLink
        class="btn btn-primary btn-block"
        style="margin-top: 18px"
        :to="
          persona.isAiPersona
            ? { name: 'persona', params: { username: persona.username } }
            : { name: 'user', params: { username: persona.username } }
        "
        @click="emit('cerrar')"
      >
        Ver su perfil
      </RouterLink>
    </div>
  </HojaInferior>
</template>

<style scoped>
.rasgos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 14px;
}
</style>
