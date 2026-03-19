<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useChatStore } from "@/stores/chat";
import { useUsersStore } from "@/stores/users";

const router = useRouter();
const chatStore = useChatStore();
const usersStore = useUsersStore();

const draft = ref("");
const messagesRef = ref(null);
let typingTimer = null;

const isAuthenticated = computed(() => usersStore.isAuthenticated);
const orderedConversations = computed(() => chatStore.conversations || []);
const activeMessages = computed(() => chatStore.activeMessages || []);

const openPanel = async () => {
  chatStore.panelOpen = true;
  chatStore.panelMinimized = false;
  if (!chatStore.activeConversationId && orderedConversations.value.length > 0) {
    await selectConversation(orderedConversations.value[0].id);
  }
};

const minimizePanel = () => {
  chatStore.sendTyping(false);
  chatStore.panelOpen = true;
  chatStore.panelMinimized = true;
};

const closePanel = () => {
  chatStore.sendTyping(false);
  chatStore.panelOpen = false;
  chatStore.panelMinimized = false;
};

const selectConversation = async (conversationId) => {
  await chatStore.fetchMessages(conversationId);
  chatStore.sendTyping(false);
  await nextTick();
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
  }
};

const sendMessage = async () => {
  const text = draft.value.trim();
  if (!text) return;
  await chatStore.sendMessage(text, usersStore.me?.id);
  draft.value = "";
  await nextTick();
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
  }
};

const onTyping = () => {
  chatStore.sendTyping(Boolean(draft.value.trim()));
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    chatStore.sendTyping(false);
  }, 1200);
};

const peerIsOnline = computed(() => {
  const peerId = Number(chatStore.activeConversation?.peer?.id || 0);
  if (!peerId) return false;
  return Boolean(chatStore.onlineByUserId[peerId]);
});

const peerIsTyping = computed(() => {
  const activeId = Number(chatStore.activeConversationId || 0);
  if (!activeId) return false;
  return Boolean(chatStore.typingByConversationId[activeId]);
});

watch(
  () => usersStore.isAuthenticated,
  async (isAuth) => {
    if (!isAuth) {
      chatStore.reset();
      return;
    }
    await chatStore.initSession();
  },
  { immediate: true }
);

watch(
  () => chatStore.activeConversationId,
  async () => {
    await nextTick();
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
    }
  }
);

watch(
  () => activeMessages.value.length,
  async () => {
    await nextTick();
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
    }
  }
);

const goProfile = (username) => {
  if (!username) return;
  router.push({ name: "perfil", params: { username } });
};

</script>

<template>
  <div v-if="isAuthenticated" class="chat-dock">
    <q-btn
      v-if="!chatStore.panelOpen || chatStore.panelMinimized"
      color="primary"
      unelevated
      class="chat-open-btn"
      @click="openPanel"
    >
      Chat
      <span v-if="orderedConversations.some((c) => Number(c.unreadCount) > 0)" class="chat-pill">
        {{
          orderedConversations.reduce(
            (acc, current) => acc + Number(current.unreadCount || 0),
            0
          )
        }}
      </span>
    </q-btn>

    <q-card v-else flat bordered class="debate-surface chat-panel">
      <q-card-section class="chat-header">
        <div class="chat-header-bar">
          <div class="text-subtitle2 text-weight-bold">Chat</div>
          <div class="chat-header-actions">
            <button type="button" class="chat-header-btn chat-header-icon-btn" aria-label="Minimizar chat" @click="minimizePanel">_</button>
            <button type="button" class="chat-header-btn chat-header-icon-btn chat-header-btn-close" aria-label="Cerrar chat" @click="closePanel">X</button>
          </div>
        </div>
      </q-card-section>

      <div class="chat-body">
        <div class="chat-left">
          <button
            v-for="conversation in orderedConversations"
            :key="conversation.id"
            class="chat-conversation-btn"
            :class="{ active: Number(conversation.id) === Number(chatStore.activeConversationId) }"
            @click="selectConversation(conversation.id)"
          >
            <div class="chat-conversation-top">
              <span class="row items-center no-wrap">
                <span class="chat-online-dot" :class="{ online: chatStore.onlineByUserId[Number(conversation.peer.id)] }"></span>
                <span class="chat-link-username" @click.stop="goProfile(conversation.peer.username)">@{{ conversation.peer.username }}</span>
              </span>
              <span v-if="conversation.unreadCount" class="chat-unread">{{ conversation.unreadCount }}</span>
            </div>
            <div class="chat-last-message">
              {{ conversation.lastMessage?.content || "Sin mensajes todavía" }}
            </div>
          </button>
        </div>

        <div class="chat-right">
          <div v-if="!chatStore.activeConversation" class="chat-empty">
            No tienes una conversación abierta.
          </div>
          <template v-else>
            <div class="chat-peer-head">
              <q-avatar size="28px" color="primary" text-color="white">
                <img
                  v-if="chatStore.activeConversation.peer.avatarUrl"
                  :src="chatStore.activeConversation.peer.avatarUrl"
                  :alt="`Avatar de ${chatStore.activeConversation.peer.username}`"
                />
                <span v-else>{{ chatStore.activeConversation.peer.username.slice(0, 1).toUpperCase() }}</span>
              </q-avatar>
              <div class="q-ml-sm column">
                <span class="text-weight-medium chat-link-username" @click="goProfile(chatStore.activeConversation.peer.username)">
                  @{{ chatStore.activeConversation.peer.username }}
                </span>
                <span class="chat-presence" :class="{ online: peerIsOnline }">
                  {{ peerIsOnline ? "en línea" : "desconectado" }}
                </span>
              </div>
            </div>

            <div ref="messagesRef" class="chat-messages">
              <div
                v-for="message in activeMessages"
                :key="message.id"
                class="chat-message"
                :class="{ mine: Number(message.senderId) === Number(usersStore.me?.id) }"
              >
                <div class="chat-bubble">{{ message.content }}</div>
              </div>
            </div>

            <div v-if="peerIsTyping" class="chat-typing">
              escribiendo...
            </div>

            <div class="chat-input-row">
              <q-input
                v-model="draft"
                dense
                outlined
                placeholder="Escribe un mensaje..."
                @keyup.enter="sendMessage"
                @update:model-value="onTyping"
              />
              <q-btn color="primary" unelevated label="Enviar" @click="sendMessage" />
            </div>
          </template>
        </div>
      </div>
    </q-card>
  </div>
</template>
