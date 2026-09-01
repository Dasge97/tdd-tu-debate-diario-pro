<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import UserAvatar from "@/components/UserAvatar.vue";
import { socialService, usersService } from "@/services";
import { useAuthStore } from "@/stores/auth";
import { useChatStore } from "@/stores/chat";
import { useUiStore } from "@/stores/ui";
import { errorMessage } from "@/api/client";
import { formatDate } from "@/utils/format";

const props = defineProps({
  username: { type: String, required: true }
});

const router = useRouter();
const auth = useAuthStore();
const chat = useChatStore();
const ui = useUiStore();

const user = ref(null);
const loading = ref(true);
const error = ref(null);
const working = ref(false);

const isMe = computed(() => user.value?.id === auth.user?.id);

onMounted(async () => {
  try {
    user.value = await usersService.byUsername(props.username);
  } catch (requestError) {
    error.value = errorMessage(requestError, "No hemos podido cargar este perfil.");
  } finally {
    loading.value = false;
  }
});

const addFriend = async () => {
  working.value = true;
  try {
    await socialService.requestById(user.value.id);
    ui.success("Solicitud enviada.");
  } catch (requestError) {
    ui.error(errorMessage(requestError, "No hemos podido enviar la solicitud."));
  } finally {
    working.value = false;
  }
};

const openChat = async () => {
  working.value = true;
  try {
    const conversation = await chat.openWith(user.value.id);
    router.push({ name: "chat", params: { id: conversation.id } });
  } catch (requestError) {
    ui.error(errorMessage(requestError, "No hemos podido abrir la conversación."));
  } finally {
    working.value = false;
  }
};
</script>

<template>
  <section>
    <div v-if="loading" class="spinner" />

    <p v-else-if="error" class="form-error">{{ error }}</p>

    <template v-else-if="user">
      <div class="surface surface-pad" style="text-align: center">
        <UserAvatar :user="user" size="lg" />
        <h1 style="margin-top: 12px; font-size: 1.35rem">{{ user.username }}</h1>

        <div v-if="user.isAiPersona" style="margin-top: 6px">
          <span class="ia-chip">PERSONAJE IA</span>
        </div>

        <p v-if="user.profileTagline" class="text-muted" style="margin: 8px 0 0">
          {{ user.profileTagline }}
        </p>

        <p v-if="user.bio" style="margin: 12px 0 0; line-height: 1.65; color: #51453b">
          {{ user.bio }}
        </p>

        <div class="user-meta">
          <span class="meta-pill">Fiabilidad {{ user.reliabilityScore ?? 0 }}</span>
          <span v-if="user.location" class="meta-pill">{{ user.location }}</span>
          <span class="meta-pill">Desde {{ formatDate(user.createdAt) }}</span>
        </div>

        <div v-if="!isMe && !user.isAiPersona" class="user-actions">
          <button class="btn btn-primary" type="button" :disabled="working" @click="addFriend">
            Añadir a amigos
          </button>
          <button class="btn btn-outline" type="button" :disabled="working" @click="openChat">
            Enviar mensaje
          </button>
        </div>

        <RouterLink
          v-if="user.isAiPersona"
          class="btn btn-primary btn-block"
          style="margin-top: 16px"
          :to="{ name: 'persona', params: { username: user.username } }"
        >
          Ver sus debates
        </RouterLink>
      </div>
    </template>
  </section>
</template>

<style scoped>
.user-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 16px;
}

.user-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}
</style>
