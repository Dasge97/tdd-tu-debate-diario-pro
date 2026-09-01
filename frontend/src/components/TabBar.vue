<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useChatStore } from "@/stores/chat";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const chat = useChatStore();
const auth = useAuthStore();

const tabs = [
  { key: "home", label: "Hoy", icon: "today", to: { name: "home" } },
  { key: "search", label: "Buscar", icon: "search", to: { name: "search" } },
  { key: "personas", label: "Personajes", icon: "groups", to: { name: "personas" } },
  { key: "chat", label: "Mensajes", icon: "forum", to: { name: "conversations" } },
  { key: "profile", label: "Perfil", icon: "person", to: { name: "profile" } }
];

const activeTab = computed(() => route.meta.tab);

const unread = computed(() => (chat.unreadTotal > 9 ? "9+" : String(chat.unreadTotal)));
</script>

<template>
  <nav class="tabbar" aria-label="Navegación principal">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      class="tabbar-item"
      :class="{ 'is-active': activeTab === tab.key }"
      :aria-current="activeTab === tab.key ? 'page' : undefined"
      @click="router.push(tab.to)"
    >
      <span class="material-symbols-rounded">{{ tab.icon }}</span>
      <span>{{ tab.label }}</span>
      <span
        v-if="auth.isAuthenticated && tab.key === 'chat' && chat.unreadTotal > 0"
        class="icon-badge"
      >
        {{ unread }}
      </span>
    </button>
  </nav>
</template>
