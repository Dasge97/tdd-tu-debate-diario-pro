<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useNotificationsStore } from "@/stores/notifications";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const notifications = useNotificationsStore();
const auth = useAuthStore();

const showBack = computed(() => Boolean(route.meta.back));
const title = computed(() => route.meta.title || "TuDebateDiario");
const isHome = computed(() => route.name === "home");

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

    <span v-if="isHome" class="brand-title">TuDebateDiario</span>
    <h1 v-else class="header-title">{{ title }}</h1>

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
