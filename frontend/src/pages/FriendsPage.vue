<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import UserAvatar from "@/components/UserAvatar.vue";
import Esqueleto from "@/components/Esqueleto.vue";
import EmptyState from "@/components/EmptyState.vue";
import { socialService } from "@/services";
import { useAuthStore } from "@/stores/auth";
import { useChatStore } from "@/stores/chat";
import { useUiStore } from "@/stores/ui";
import { errorMessage } from "@/api/client";

const router = useRouter();
const auth = useAuthStore();
const chat = useChatStore();
const ui = useUiStore();

const friends = ref([]);
const pending = ref([]);
const loading = ref(true);
const username = ref("");
const sending = ref(false);

/**
 * Una amistad tiene solicitante y destinatario. Para pintar la lista siempre
 * interesa la otra persona, sea cual sea de los dos lados.
 */
const otherUser = (friendship) =>
  friendship.requester.id === auth.user?.id ? friendship.addressee : friendship.requester;

/* Solo se pueden aceptar las solicitudes que ha enviado otra persona. */
const incoming = computed(() =>
  pending.value.filter((friendship) => friendship.requester.id !== auth.user?.id)
);

const outgoing = computed(() =>
  pending.value.filter((friendship) => friendship.requester.id === auth.user?.id)
);

const load = async () => {
  loading.value = true;
  try {
    const data = await socialService.friends();
    friends.value = data.friends || [];
    pending.value = data.pending || [];
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido cargar tus amigos."));
  } finally {
    loading.value = false;
  }
};

onMounted(load);

const request = async () => {
  const name = username.value.trim();
  if (!name || sending.value) return;

  sending.value = true;
  try {
    await socialService.requestByUsername(name);
    username.value = "";
    ui.success("Solicitud enviada.");
    await load();
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido enviar la solicitud."));
  } finally {
    sending.value = false;
  }
};

const accept = async (friendship) => {
  try {
    await socialService.accept(friendship.requester.id);
    ui.success("Solicitud aceptada.");
    await load();
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido aceptar la solicitud."));
  }
};

const remove = async (friendship) => {
  const other = otherUser(friendship);
  if (!window.confirm(`¿Quitar a ${other.username} de tus amigos?`)) return;

  try {
    await socialService.remove(other.id);
    await load();
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido completar la acción."));
  }
};

const openChat = async (friendship) => {
  try {
    const conversation = await chat.openWith(otherUser(friendship).id);
    router.push({ name: "chat", params: { id: conversation.id } });
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido abrir la conversación."));
  }
};
</script>

<template>
  <section>
    <form class="surface surface-pad" style="margin-bottom: 18px" @submit.prevent="request">
      <label class="field" style="margin-bottom: 12px">
        <span class="field-label">Añadir por nombre de usuario</span>
        <input
          v-model="username"
          class="input"
          type="text"
          autocapitalize="none"
          autocomplete="off"
          placeholder="Su nombre exacto"
        />
      </label>
      <button class="btn btn-primary btn-block" type="submit" :disabled="!username.trim() || sending">
        {{ sending ? "Enviando…" : "Enviar solicitud" }}
      </button>
    </form>

    <Esqueleto v-if="loading" tipo="lista" :cantidad="4" />

    <template v-else>
      <template v-if="incoming.length">
        <div class="section-head">
          <h2 class="section-title">Solicitudes recibidas</h2>
        </div>

        <div class="surface list-card" style="margin-bottom: 18px">
          <div v-for="friendship in incoming" :key="friendship.id" class="list-row">
            <UserAvatar :user="friendship.requester" />
            <span class="list-row-main">
              <span class="list-row-title">{{ friendship.requester.username }}</span>
              <span class="list-row-sub">Quiere ser tu amigo</span>
            </span>
            <button class="btn btn-primary btn-sm" type="button" @click="accept(friendship)">
              Aceptar
            </button>
          </div>
        </div>
      </template>

      <div class="section-head">
        <h2 class="section-title">Amigos</h2>
        <span class="text-muted" style="font-size: 0.85rem">{{ friends.length }}</span>
      </div>

      <div v-if="friends.length" class="surface list-card">
        <div v-for="friendship in friends" :key="friendship.id" class="list-row">
          <UserAvatar :user="otherUser(friendship)" />
          <RouterLink
            class="list-row-main"
            :to="{ name: 'user', params: { username: otherUser(friendship).username } }"
          >
            <span class="list-row-title">{{ otherUser(friendship).username }}</span>
          </RouterLink>
          <button
            class="icon-btn"
            type="button"
            aria-label="Abrir conversación"
            @click="openChat(friendship)"
          >
            <span class="material-symbols-rounded">chat</span>
          </button>
          <button class="icon-btn" type="button" aria-label="Quitar amigo" @click="remove(friendship)">
            <span class="material-symbols-rounded">person_remove</span>
          </button>
        </div>
      </div>

      <EmptyState
        v-else
        icon="group_add"
        title="Todavía no tienes amigos"
        text="Añade a alguien por su nombre de usuario para hablar en privado."
      />

      <template v-if="outgoing.length">
        <div class="section-head" style="margin-top: 22px">
          <h2 class="section-title">Solicitudes enviadas</h2>
        </div>

        <div class="surface list-card">
          <div v-for="friendship in outgoing" :key="friendship.id" class="list-row">
            <UserAvatar :user="friendship.addressee" />
            <span class="list-row-main">
              <span class="list-row-title">{{ friendship.addressee.username }}</span>
              <span class="list-row-sub">Pendiente de respuesta</span>
            </span>
            <button class="btn btn-outline btn-sm" type="button" @click="remove(friendship)">
              Cancelar
            </button>
          </div>
        </div>
      </template>
    </template>
  </section>
</template>
