import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

/**
 * Toda la API bajo /api/v1 exige token salvo login, registro y refresco,
 * asi que cada pantalla de contenido requiere sesion iniciada.
 */
const routes = [
  {
    path: "/entrar",
    name: "login",
    component: () => import("@/pages/LoginPage.vue"),
    meta: { public: true, chrome: false }
  },
  {
    path: "/registro",
    name: "register",
    component: () => import("@/pages/RegisterPage.vue"),
    meta: { public: true, chrome: false }
  },
  {
    path: "/",
    name: "home",
    component: () => import("@/pages/HomePage.vue"),
    meta: { title: "TuDebateDiario", tab: "home" }
  },
  {
    path: "/debate/:id",
    name: "debate",
    component: () => import("@/pages/DebatePage.vue"),
    props: true,
    meta: { title: "Debate", back: true }
  },
  {
    path: "/proponer",
    name: "propose",
    component: () => import("@/pages/ProposeDebatePage.vue"),
    meta: { title: "Proponer debate", back: true }
  },
  {
    path: "/buscar",
    name: "search",
    component: () => import("@/pages/SearchPage.vue"),
    meta: { title: "Buscar", tab: "search" }
  },
  {
    path: "/personajes",
    name: "personas",
    component: () => import("@/pages/PersonasPage.vue"),
    meta: { title: "Personajes", tab: "personas" }
  },
  {
    path: "/personajes/:username",
    name: "persona",
    component: () => import("@/pages/PersonaProfilePage.vue"),
    props: true,
    meta: { title: "Personaje", back: true }
  },
  {
    path: "/mensajes",
    name: "conversations",
    component: () => import("@/pages/ConversationsPage.vue"),
    meta: { title: "Mensajes", tab: "chat" }
  },
  {
    path: "/mensajes/:id",
    name: "chat",
    component: () => import("@/pages/ChatPage.vue"),
    props: true,
    meta: { title: "Conversación", back: true, hideTabbar: true }
  },
  {
    path: "/amigos",
    name: "friends",
    component: () => import("@/pages/FriendsPage.vue"),
    meta: { title: "Amigos", back: true }
  },
  {
    path: "/notificaciones",
    name: "notifications",
    component: () => import("@/pages/NotificationsPage.vue"),
    meta: { title: "Notificaciones", back: true }
  },
  {
    path: "/perfil",
    name: "profile",
    component: () => import("@/pages/MyProfilePage.vue"),
    meta: { title: "Mi perfil", tab: "profile" }
  },
  {
    path: "/perfil/editar",
    name: "edit-profile",
    component: () => import("@/pages/EditProfilePage.vue"),
    meta: { title: "Editar perfil", back: true }
  },
  {
    path: "/perfil/favoritos",
    name: "favorites",
    component: () => import("@/pages/FavoritesPage.vue"),
    meta: { title: "Favoritos", back: true }
  },
  {
    path: "/usuario/:username",
    name: "user",
    component: () => import("@/pages/UserProfilePage.vue"),
    props: true,
    meta: { title: "Perfil", back: true }
  },
  {
    path: "/ajustes",
    name: "settings",
    component: () => import("@/pages/SettingsPage.vue"),
    meta: { title: "Ajustes", back: true }
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: () => import("@/pages/NotFoundPage.vue"),
    meta: { title: "No encontrado", back: true }
  }
];

export const router = createRouter({
  history: createWebHistory("/app/"),
  routes,
  scrollBehavior(to, from, saved) {
    return saved || { top: 0 };
  }
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.ready) {
    await auth.restore();
  }

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: "login", query: { destino: to.fullPath } };
  }

  if (to.meta.public && auth.isAuthenticated) {
    return { name: "home" };
  }

  return true;
});
