import { defineStore } from "pinia";
import { authService, usersService } from "@/services";
import { tokenStorage, errorMessage } from "@/api/client";

const USER_KEY = "tdd.user";

/**
 * Sesion del usuario. El perfil se guarda en localStorage para pintar la
 * interfaz al instante en el arranque, y se refresca contra /users/me despues.
 */
export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: JSON.parse(localStorage.getItem(USER_KEY) || "null"),
    ready: false,
    loading: false,
    error: null
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.user && tokenStorage.getAccess()),
    isAdmin: (state) => state.user?.role === "admin"
  },

  actions: {
    persistUser(user) {
      this.user = user;
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    },

    async login(email, password) {
      this.loading = true;
      this.error = null;
      try {
        const data = await authService.login(email, password);
        tokenStorage.set(data.accessToken, data.refreshToken);
        this.persistUser(data.user);
        this.ready = true;
        return true;
      } catch (error) {
        this.error = errorMessage(error, "No hemos podido iniciar sesión.");
        return false;
      } finally {
        this.loading = false;
      }
    },

    async register(username, email, password) {
      this.loading = true;
      this.error = null;
      try {
        const data = await authService.register(username, email, password);
        tokenStorage.set(data.accessToken, data.refreshToken);
        this.persistUser(data.user);
        this.ready = true;
        return true;
      } catch (error) {
        this.error = errorMessage(error, "No hemos podido crear la cuenta.");
        return false;
      } finally {
        this.loading = false;
      }
    },

    /** Comprueba al arrancar si el token guardado sigue siendo valido. */
    async restore() {
      if (!tokenStorage.getAccess()) {
        this.ready = true;
        return;
      }
      try {
        const user = await usersService.me();
        this.persistUser(user);
      } catch (_) {
        this.clearSession();
      } finally {
        this.ready = true;
      }
    },

    async refreshProfile() {
      const user = await usersService.me();
      this.persistUser(user);
      return user;
    },

    clearSession() {
      tokenStorage.clear();
      this.persistUser(null);
    },

    async logout() {
      const refreshToken = tokenStorage.getRefresh();
      try {
        await authService.logout(refreshToken);
      } catch (_) {
        /* La sesion local se cierra igualmente. */
      }
      this.clearSession();
    }
  }
});
