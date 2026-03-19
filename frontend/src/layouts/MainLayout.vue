<script setup>
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useUsersStore } from "@/stores/users";
import { useFavoritesStore } from "@/stores/favorites";
import { useNotificationsStore } from "@/stores/notifications";
import { useToastStore } from "@/stores/toast";
import { useModalStore } from "@/stores/modal";
import ChatDock from "@/components/ChatDock.vue";

const leftDrawerOpen = ref(false);
const authDialog = ref(false);
const profileDialog = ref(false);
const authMode = ref("login");
const form = ref({ username: "", email: "", password: "" });
const searchText = ref("");

const router = useRouter();
const usersStore = useUsersStore();
const favoritesStore = useFavoritesStore();
const notificationsStore = useNotificationsStore();
const toastStore = useToastStore();
const modalStore = useModalStore();

const openAuthDialog = (mode = "login") => {
  authMode.value = mode;
  usersStore.authError = "";
  authDialog.value = true;
};

const submitAuth = async () => {
  const payload = {
    username: form.value.username?.trim(),
    email: form.value.email?.trim(),
    password: form.value.password
  };

  try {
    if (authMode.value === "register") {
      await usersStore.register(payload);
      toastStore.success("Tu cuenta se ha creado correctamente.");
    } else {
      await usersStore.login({ email: payload.email, password: payload.password });
      toastStore.success("Has iniciado sesión.");
    }

    authDialog.value = false;
    form.value.password = "";
  } catch (error) {
    toastStore.error(usersStore.authError || error?.response?.data?.error || "No se pudo completar la autenticación.");
  }
};

const openProfile = async () => {
  if (!usersStore.isAuthenticated) {
    openAuthDialog("login");
    return;
  }
  await usersStore.fetchMe();
  profileDialog.value = true;
};

onMounted(async () => {
  await usersStore.fetchMe();
  if (usersStore.isAuthenticated) {
    await Promise.all([
      favoritesStore.fetchFavorites(),
      notificationsStore.fetchList(20),
      notificationsStore.fetchUnreadCount()
    ]);
  }
});

watch(
  () => usersStore.isAuthenticated,
  async (isAuthenticated) => {
    if (isAuthenticated) {
      await Promise.all([
        favoritesStore.fetchFavorites(),
        notificationsStore.fetchList(20),
        notificationsStore.fetchUnreadCount()
      ]);
    } else {
      favoritesStore.items = [];
      notificationsStore.reset();
    }
  }
);

const submitSearch = () => {
  if (!searchText.value?.trim()) {
    toastStore.info("Escribe algo para buscar debates.");
    return;
  }
  router.push({ name: "buscar", query: { q: searchText.value || undefined } });
};

const goToMyProfile = async () => {
  if (!usersStore.isAuthenticated) {
    openAuthDialog("login");
    return;
  }
  await usersStore.fetchMe();
  if (usersStore.me?.username) {
    router.push({ name: "perfil", params: { username: usersStore.me.username } });
  }
};

const openNotifications = async () => {
  if (!usersStore.isAuthenticated) return;
  await notificationsStore.fetchList(20);
};

const markAllNotificationsRead = async () => {
  if (!usersStore.isAuthenticated) return;
  await notificationsStore.markAllRead();
  toastStore.success("Notificaciones marcadas como leídas.");
};

const handleLogout = async () => {
  const confirmed = await modalStore.confirm({
    title: "Cerrar sesión",
    message: "Se cerrará tu sesión actual en Tu Debate Diario.",
    confirmLabel: "Salir",
    cancelLabel: "Cancelar"
  });
  if (!confirmed) return;
  await usersStore.logout();
  toastStore.info("Has cerrado sesión.");
};
</script>

<template>
  <q-layout view="hHh Lpr lff" :class="['app-layout', { 'drawer-open': leftDrawerOpen }]">
    <q-header elevated class="main-header text-dark">
      <q-toolbar class="q-px-md main-toolbar">
        <div class="header-left">
          <q-btn flat dense round icon="menu" class="header-icon-btn" @click="leftDrawerOpen = !leftDrawerOpen" />
          <q-toolbar-title class="brand-title">TDD</q-toolbar-title>
        </div>

        <div class="header-center">
          <div class="header-search">
            <span class="material-icons header-search-icon" aria-hidden="true">search</span>
            <input
              v-model="searchText"
              type="text"
              class="header-search-input"
              placeholder="Busca un debate en concreto"
              @keyup.enter="submitSearch"
            />
            <button
              type="button"
              class="header-search-action"
              aria-label="Buscar"
              @click="submitSearch"
            >
              <span class="material-icons" aria-hidden="true">arrow_forward</span>
            </button>
          </div>
        </div>

        <div class="header-right">
          <q-btn
            v-if="usersStore.isAdmin"
            flat
            color="dark"
            label="Admin"
            class="q-mr-sm header-action-btn"
            @click="router.push({ name: 'admin' })"
          />
          <q-btn
            v-if="usersStore.isAuthenticated"
            color="deep-orange-7"
            unelevated
            label="+ Proponer debate"
            class="q-mr-sm header-action-btn propose-btn"
            @click="router.push({ name: 'proponer-debate' })"
          />
          <q-btn
            v-if="!usersStore.isAuthenticated"
            color="primary"
            unelevated
            label="Entrar"
            class="header-action-btn"
            @click="openAuthDialog('login')"
          />
          <q-btn
            v-else
            flat
            color="primary"
            label="Perfil"
            class="q-mr-sm header-action-btn"
            @click="goToMyProfile"
          />
          <q-btn
            v-if="usersStore.isAuthenticated"
            flat
            round
            icon="notifications"
            class="q-mr-sm header-action-btn"
            @click="openNotifications"
          >
            <q-badge
              v-if="notificationsStore.unreadCount > 0"
              color="negative"
              floating
              rounded
            >
              {{ notificationsStore.unreadCount > 99 ? "99+" : notificationsStore.unreadCount }}
            </q-badge>
            <q-menu anchor="bottom right" self="top right">
              <q-list class="notifications-menu-list" style="min-width: 330px; max-width: 380px; max-height: 420px; overflow-y: auto;">
                <q-item>
                  <q-item-section>
                    <q-item-label class="text-weight-bold">Notificaciones</q-item-label>
                    <q-item-label caption>Actualización en tiempo real</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn flat dense size="sm" color="primary" label="Marcar leídas" @click="markAllNotificationsRead" />
                  </q-item-section>
                </q-item>
                <q-separator />
                <q-item v-for="notification in notificationsStore.items" :key="notification.id">
                  <q-item-section>
                    <q-item-label class="text-weight-medium">
                      {{ notification.title }}
                    </q-item-label>
                    <q-item-label caption>{{ notification.body }}</q-item-label>
                  </q-item-section>
                  <q-item-section side v-if="!notification.isRead">
                    <q-badge color="primary" rounded />
                  </q-item-section>
                </q-item>
                <q-item v-if="notificationsStore.items.length === 0">
                  <q-item-section>
                    <q-item-label caption>No tienes notificaciones por ahora.</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
          <q-btn
            v-if="usersStore.isAuthenticated"
            flat
            color="negative"
            label="Salir"
            class="header-action-btn"
            @click="handleLogout"
          />
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      behavior="desktop"
      :breakpoint="1280"
      bordered
      :width="276"
      class="main-drawer"
    >
      <q-list padding class="drawer-nav-list">
        <q-item clickable v-ripple class="drawer-item" @click="router.push({ name: 'home' })">
          <q-item-section avatar><q-icon name="calendar_month" /></q-item-section>
          <q-item-section>Debates de hoy</q-item-section>
        </q-item>
        <q-item clickable v-ripple class="drawer-item" @click="router.push({ name: 'comunidad' })">
          <q-item-section avatar><q-icon name="public" /></q-item-section>
          <q-item-section>Comunidad</q-item-section>
        </q-item>
        <q-item clickable v-ripple class="drawer-item" @click="router.push({ name: 'buscar' })">
          <q-item-section avatar><q-icon name="manage_search" /></q-item-section>
          <q-item-section>Debates recientes</q-item-section>
        </q-item>
        <q-item clickable v-ripple class="drawer-item" @click="router.push({ name: 'tendencias' })">
          <q-item-section avatar><q-icon name="insights" /></q-item-section>
          <q-item-section>Tendencias</q-item-section>
        </q-item>
        <q-item clickable v-ripple class="drawer-item" @click="router.push({ name: 'favoritos' })">
          <q-item-section avatar><q-icon name="bookmark_added" /></q-item-section>
          <q-item-section>Guardados</q-item-section>
        </q-item>
        <q-item clickable v-ripple class="drawer-item" @click="router.push({ name: 'amigos' })">
          <q-item-section avatar><q-icon name="diversity_3" /></q-item-section>
          <q-item-section>Amigos</q-item-section>
        </q-item>
        <q-item v-if="usersStore.isAdmin" clickable v-ripple class="drawer-item" @click="router.push({ name: 'admin' })">
          <q-item-section avatar><q-icon name="shield_person" /></q-item-section>
          <q-item-section>Administración</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-dialog v-model="authDialog" persistent class="auth-dialog">
      <q-card class="app-modal-card auth-dialog-card">
        <q-card-section>
          <div class="text-h6">{{ authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta' }}</div>
          <div class="text-caption text-grey-7">Participa en los debates con tu perfil.</div>
        </q-card-section>

        <q-card-section class="q-gutter-sm">
          <q-input v-if="authMode === 'register'" v-model="form.username" outlined dense label="Nombre de usuario" />
          <q-input v-model="form.email" outlined dense type="email" label="Email" />
          <q-input v-model="form.password" outlined dense type="password" label="Contraseña" />
          <div v-if="usersStore.authError" class="text-negative text-caption">{{ usersStore.authError }}</div>
        </q-card-section>

        <q-card-actions align="between" class="auth-dialog-actions">
          <q-btn flat label="Cancelar" v-close-popup />
          <q-btn color="primary" unelevated :label="authMode === 'login' ? 'Entrar' : 'Registrar'" @click="submitAuth" />
        </q-card-actions>

        <q-card-section class="q-pt-none">
          <q-btn
            flat
            color="primary"
            class="q-px-none"
            :label="authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'"
            @click="authMode = authMode === 'login' ? 'register' : 'login'"
          />
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="profileDialog" class="profile-dialog">
      <q-card class="app-modal-card profile-dialog-card">
        <q-card-section>
          <div class="text-h6">Tu perfil</div>
        </q-card-section>
        <q-card-section v-if="usersStore.me">
          <div><strong>Usuario:</strong> {{ usersStore.me.username }}</div>
          <div><strong>Email:</strong> {{ usersStore.me.email }}</div>
          <div><strong>Rol:</strong> {{ usersStore.me.role }}</div>
          <div><strong>Índice de criterio:</strong> {{ usersStore.me.reliabilityScore }}</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cerrar" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <chat-dock />
  </q-layout>
</template>
