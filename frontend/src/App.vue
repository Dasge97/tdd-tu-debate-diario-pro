<script setup>
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import TabBar from "@/components/TabBar.vue";
import ToastHost from "@/components/ToastHost.vue";
import InstallPrompt from "@/components/InstallPrompt.vue";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { useChatStore } from "@/stores/chat";
import { useNotificationsStore } from "@/stores/notifications";
import { useFavoritesStore } from "@/stores/favorites";
import { wsClient } from "@/api/ws";
import { direccion } from "@/composables/useNavegacion";
import { useGestoVolver } from "@/composables/useGestoVolver";

const route = useRoute();
const auth = useAuthStore();
const ui = useUiStore();
const chat = useChatStore();
const notifications = useNotificationsStore();
const favorites = useFavoritesStore();

useGestoVolver();

// La cabecera y la barra inferior se ven tambien sin cuenta: la lectura es
// publica. Solo la pantalla de entrada y la de registro van sin ellas.
const showChrome = computed(() => route.meta.chrome !== false);
const showTabbar = computed(() => showChrome.value && !route.meta.hideTabbar);

/** Datos que la cabecera y la barra inferior necesitan en todas las pantallas. */
const loadSessionData = () => {
  chat.listen();
  wsClient.connect();
  notifications.load(true).catch(() => {});
  chat.loadConversations(true).catch(() => {});
  favorites.load(true).catch(() => {});
};

onMounted(() => {
  if (auth.isAuthenticated) loadSessionData();
});

watch(
  () => auth.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      loadSessionData();
    } else {
      wsClient.disconnect();
      chat.reset();
      notifications.reset();
      favorites.reset();
    }
  }
);
</script>

<template>
  <div class="app-shell">
    <AppHeader v-if="showChrome" />

    <div v-if="!ui.online" class="offline-banner">
      Sin conexión. Estás viendo lo último que se descargó.
    </div>

    <main class="app-main">
      <RouterView v-slot="{ Component, route }">
        <Transition :name="direccion === 'atras' ? 'pantalla-atras' : 'pantalla'" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>

    <TabBar v-if="showTabbar" />
    <InstallPrompt v-if="showChrome" />
    <ToastHost />
  </div>
</template>
