<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useChatStore } from "@/stores/chat";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { chatService } from "@/services";
import { errorMessage } from "@/api/client";
import { formatTime } from "@/utils/format";

const props = defineProps({
  id: { type: [String, Number], required: true }
});

const chat = useChatStore();
const auth = useAuthStore();
const ui = useUiStore();

const conversationId = Number(props.id);

const conversation = ref(null);
const draft = ref("");
const sending = ref(false);
const loading = ref(true);
const bottom = ref(null);

const messages = computed(() => chat.messagesOf(conversationId));
const isMine = (message) => message.senderId === auth.user?.id;

const scrollToBottom = async () => {
  await nextTick();
  bottom.value?.scrollIntoView({ block: "end" });
};

onMounted(async () => {
  try {
    conversation.value = await chatService.conversation(conversationId);
    await chat.loadMessages(conversationId);
    await scrollToBottom();
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido abrir la conversación."));
  } finally {
    loading.value = false;
  }
});

/* Los mensajes que llegan por el websocket bajan la vista sola. */
watch(() => messages.value.length, scrollToBottom);

const send = async () => {
  const content = draft.value.trim();
  if (!content || sending.value) return;

  sending.value = true;
  try {
    await chat.send(conversationId, content);
    draft.value = "";
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido enviar el mensaje."));
  } finally {
    sending.value = false;
  }
};

const autoGrow = (event) => {
  const element = event.target;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
};
</script>

<template>
  <section class="chat-page">
    <div v-if="conversation?.otherUser" class="chat-peer">
      <RouterLink :to="{ name: 'user', params: { username: conversation.otherUser.username } }">
        {{ conversation.otherUser.username }}
      </RouterLink>
    </div>

    <div v-if="loading" class="spinner" />

    <div v-else class="chat-scroll">
      <p v-if="!messages.length" class="text-muted" style="text-align: center; padding: 30px 0">
        Todavía no hay mensajes. Escribe el primero.
      </p>

      <div
        v-for="message in messages"
        :key="message.id"
        class="bubble"
        :class="isMine(message) ? 'bubble-out' : 'bubble-in'"
      >
        {{ message.content }}
        <span class="bubble-time">{{ formatTime(message.createdAt) }}</span>
      </div>

      <div ref="bottom" />
    </div>

    <div class="composer chat-composer">
      <textarea
        v-model="draft"
        rows="1"
        placeholder="Escribe un mensaje…"
        aria-label="Escribe un mensaje"
        @input="autoGrow"
        @keydown.enter.exact.prevent="send"
      />
      <button
        type="button"
        class="composer-send"
        aria-label="Enviar mensaje"
        :disabled="!draft.trim() || sending"
        @click="send"
      >
        <span class="material-symbols-rounded">send</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - var(--tdd-header-h) - var(--safe-top) - 32px);
}

.chat-peer {
  margin-bottom: 10px;
  text-align: center;
  font-size: 0.85rem;
  color: var(--tdd-muted);
}

.chat-scroll {
  flex: 1 1 auto;
}

/* Aqui no hay barra inferior, asi que el redactor se pega al borde. */
.chat-composer {
  bottom: 0;
  margin-bottom: calc(-1 * var(--safe-bottom));
  padding-bottom: calc(10px + var(--safe-bottom));
}
</style>
