import { createRouter, createWebHistory } from "vue-router";
import { routes } from "@/router/routes";
import { useUsersStore } from "@/stores/users";

export const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to) => {
  if (!to.meta?.requiresAdmin) return true;

  const usersStore = useUsersStore();
  if (!usersStore.isAuthenticated) {
    return { name: "home" };
  }

  if (!usersStore.me) {
    try {
      await usersStore.fetchMe();
    } catch (_error) {
      return { name: "home" };
    }
  }

  if (!usersStore.isAdmin) {
    return { name: "home" };
  }

  return true;
});
