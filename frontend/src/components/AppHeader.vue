<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useNotificationsStore } from "@/stores/notifications";
import { useAuthStore } from "@/stores/auth";
import { useChatStore } from "@/stores/chat";

const route = useRoute();
const router = useRouter();
const notifications = useNotificationsStore();
const auth = useAuthStore();
const chat = useChatStore();

/* En escritorio no hay barra inferior: las mismas secciones van en la cabecera. */
const secciones = [
  { key: "home", label: "Hoy", icon: "today", to: { name: "home" } },
  { key: "search", label: "Buscar", icon: "search", to: { name: "search" } },
  { key: "personas", label: "Personajes", icon: "groups", to: { name: "personas" } },
  { key: "chat", label: "Mensajes", icon: "forum", to: { name: "conversations" } },
  { key: "profile", label: "Perfil", icon: "person", to: { name: "profile" } }
];

const showBack = computed(() => Boolean(route.meta.back));
const title = computed(() => route.meta.title || "TuDebateDiario");
const isHome = computed(() => route.name === "home");
const seccionActiva = computed(() => route.meta.tab);

const unread = computed(() =>
  notifications.unreadCount > 9 ? "9+" : String(notifications.unreadCount)
);

const goBack = () => {
  if (window.history.state?.back) {
    router.back();
  } else {
    router.push({ name: "home" });
  }
};
</script>

<template>
  <header class="app-header">
    <button v-if="showBack" class="icon-btn" type="button" aria-label="Volver" @click="goBack">
      <span class="material-symbols-rounded">arrow_back</span>
    </button>

    <RouterLink v-if="isHome" class="brand-title" :to="{ name: 'home' }">
      TuDebateDiario
    </RouterLink>
    <h1 v-else class="header-title">{{ title }}</h1>

    <nav class="header-nav" aria-label="Secciones">
      <RouterLink
        v-for="seccion in secciones"
        :key="seccion.key"
        class="header-nav-item"
        :class="{ 'is-active': seccionActiva === seccion.key }"
        :to="seccion.to"
      >
        <span class="material-symbols-rounded">{{ seccion.icon }}</span>
        {{ seccion.label }}
        <span
          v-if="auth.isAuthenticated && seccion.key === 'chat' && chat.unreadTotal > 0"
          class="unread-dot"
        >
          {{ chat.unreadTotal }}
        </span>
      </RouterLink>
    </nav>

    <span class="header-spacer" />

    <template v-if="auth.isAuthenticated">
      <RouterLink
        class="icon-btn"
        :to="{ name: 'notifications' }"
        aria-label="Notificaciones"
      >
        <span class="material-symbols-rounded">notifications</span>
        <span v-if="notifications.unreadCount > 0" class="icon-badge">{{ unread }}</span>
      </RouterLink>

      <RouterLink class="icon-btn" :to="{ name: 'settings' }" aria-label="Ajustes">
        <span class="material-symbols-rounded">settings</span>
      </RouterLink>
    </template>

    <RouterLink
      v-else
      class="btn btn-primary btn-sm"
      :to="{ name: 'login', query: { destino: route.fullPath } }"
    >
      Entrar
    </RouterLink>
  </header>
</template>
