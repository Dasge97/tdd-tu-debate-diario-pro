<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import EmptyState from "@/components/EmptyState.vue";
import Esqueleto from "@/components/Esqueleto.vue";
import { useNotificationsStore } from "@/stores/notifications";
import { useUiStore } from "@/stores/ui";
import { errorMessage } from "@/api/client";
import { formatRelative } from "@/utils/format";

const router = useRouter();
const notifications = useNotificationsStore();
const ui = useUiStore();

onMounted(() => notifications.load(true));

const iconFor = (type) => {
  if (type?.includes("comment")) return "chat_bubble";
  if (type?.includes("friend")) return "group";
  if (type?.includes("debate")) return "campaign";
  if (type?.includes("chat") || type?.includes("message")) return "forum";
  return "notifications";
};

const open = async (notification) => {
  if (!notification.isRead) {
    notifications.markRead(notification.id).catch(() => {});
  }

  const debateId = notification.data?.debateId;
  const conversationId = notification.data?.conversationId;

  if (debateId) {
    router.push({ name: "debate", params: { id: debateId } });
  } else if (conversationId) {
    router.push({ name: "chat", params: { id: conversationId } });
  }
};

const markAll = async () => {
  try {
    await notifications.markAllRead();
    ui.success("Todo marcado como leído.");
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido marcarlas como leídas."));
  }
};
</script>

<template>
  <section>
    <div class="section-head">
      <h2 class="section-title">Notificaciones</h2>
      <button
        v-if="notifications.unreadCount > 0"
        class="btn btn-ghost btn-sm"
        type="button"
        @click="markAll"
      >
        Marcar todo leído
      </button>
    </div>

    <Esqueleto v-if="notifications.loading && !notifications.items.length" tipo="lista" :cantidad="5" />

    <div v-else-if="notifications.items.length" class="surface list-card">
      <button
        v-for="notification in notifications.items"
        :key="notification.id"
        type="button"
        class="list-row"
        :style="notification.isRead ? '' : 'background: rgba(31,75,163,0.05)'"
        @click="open(notification)"
      >
        <span class="material-symbols-rounded" style="color: var(--tdd-primary)">
          {{ iconFor(notification.type) }}
        </span>
        <span class="list-row-main">
          <span class="list-row-title" style="white-space: normal">{{ notification.title }}</span>
          <span class="list-row-sub" style="white-space: normal">{{ notification.body }}</span>
        </span>
        <span class="list-row-aside">
          <span class="text-muted" style="font-size: 0.74rem">
            {{ formatRelative(notification.createdAt) }}
          </span>
        </span>
      </button>
    </div>

    <EmptyState
      v-else
      icon="notifications_off"
      title="Sin notificaciones"
      text="Aquí verás las respuestas a tus comentarios y las solicitudes de amistad."
    />
  </section>
</template>
