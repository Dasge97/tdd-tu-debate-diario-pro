import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { calcularDireccion, direccion } from "@/composables/useNavegacion";

/**
 * Los debates, los personajes y los perfiles se pueden leer sin cuenta.
 * Las pantallas marcadas con requiereSesion mandan a la pantalla de entrada,
 * guardando en la consulta la direccion a la que se queria ir.
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
    meta: { requiereSesion: true, title: "Proponer debate", back: true }
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
    meta: { requiereSesion: true, title: "Mensajes", tab: "chat" }
  },
  {
    path: "/mensajes/:id",
    name: "chat",
    component: () => import("@/pages/ChatPage.vue"),
    props: true,
    meta: { requiereSesion: true, title: "Conversación", back: true, hideTabbar: true }
  },
  {
    path: "/amigos",
    name: "friends",
    component: () => import("@/pages/FriendsPage.vue"),
    meta: { requiereSesion: true, title: "Amigos", back: true }
  },
  {
    path: "/notificaciones",
    name: "notifications",
    component: () => import("@/pages/NotificationsPage.vue"),
    meta: { requiereSesion: true, title: "Notificaciones", back: true }
  },
  {
    path: "/perfil",
    name: "profile",
    component: () => import("@/pages/MyProfilePage.vue"),
    meta: { requiereSesion: true, title: "Mi perfil", tab: "profile" }
  },
  {
    path: "/perfil/editar",
    name: "edit-profile",
    component: () => import("@/pages/EditProfilePage.vue"),
    meta: { requiereSesion: true, title: "Editar perfil", back: true }
  },
  {
    path: "/perfil/favoritos",
    name: "favorites",
    component: () => import("@/pages/FavoritesPage.vue"),
    meta: { requiereSesion: true, title: "Favoritos", back: true }
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
    meta: { requiereSesion: true, title: "Ajustes", back: true }
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
  /* Al volver atras se recupera el sitio donde estabas en la lista. */
  scrollBehavior(to, from, saved) {
    if (saved) {
      return new Promise((resolver) => {
        setTimeout(() => resolver(saved), 220);
      });
    }
    return { top: 0 };
  }
});

router.beforeEach(async (to, from) => {
  const auth = useAuthStore();

  direccion.value = calcularDireccion(to, from);

  if (!auth.ready) {
    await auth.restore();
  }

  if (to.meta.requiereSesion && !auth.isAuthenticated) {
    return { name: "login", query: { destino: to.fullPath } };
  }

  if (to.meta.public && auth.isAuthenticated) {
    return { name: "home" };
  }

  return true;
});
