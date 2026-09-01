<script setup>
import { onMounted } from "vue";
import UserAvatar from "@/components/UserAvatar.vue";
import Esqueleto from "@/components/Esqueleto.vue";
import EmptyState from "@/components/EmptyState.vue";
import { useChatStore } from "@/stores/chat";
import { formatRelative } from "@/utils/format";

const chat = useChatStore();

onMounted(() => chat.loadConversations(true));
</script>

<template>
  <section>
    <div class="section-head">
      <h2 class="section-title">Mensajes</h2>
      <RouterLink class="btn btn-ghost btn-sm" :to="{ name: 'friends' }">Amigos</RouterLink>
    </div>

    <Esqueleto v-if="chat.loading && !chat.conversations.length" tipo="lista" :cantidad="5" />

    <div v-else-if="chat.conversations.length" class="surface list-card">
      <RouterLink
        v-for="conversation in chat.conversations"
        :key="conversation.id"
        class="list-row"
        :to="{ name: 'chat', params: { id: conversation.id } }"
      >
        <UserAvatar :user="conversation.otherUser" />
        <span class="list-row-main">
          <span class="list-row-title">
            {{ conversation.otherUser?.username || "Conversación" }}
          </span>
          <span class="list-row-sub">
            {{ conversation.lastMessage?.content || "Sin mensajes todavía" }}
          </span>
        </span>
        <span class="list-row-aside">
          <span class="text-muted" style="font-size: 0.75rem">
            {{ formatRelative(conversation.lastMessage?.createdAt) }}
          </span>
          <span v-if="conversation.unreadCount > 0" class="unread-dot">
            {{ conversation.unreadCount }}
          </span>
        </span>
      </RouterLink>
    </div>

    <EmptyState
      v-else
      icon="forum"
      title="Sin conversaciones"
      text="Añade amigos para empezar a hablar en privado."
    >
      <RouterLink class="btn btn-primary" :to="{ name: 'friends' }" style="margin-top: 16px">
        Buscar amigos
      </RouterLink>
    </EmptyState>
  </section>
</template>
